# Execution & Evidence Workspace — handoff

Everything a second person needs to pick this up. Kept current as the feature
is built; if it disagrees with the code, the code is right and this file is
stale — say so in the PR.

Last updated: plan-vs-reality rollups (step 6 of 6). All six steps of the
build plan are done; **§7 is the complete list of what is left**.

---

## 1. What this feature is

A student does a real project — their own idea, an AI-suggested one, or one
they were hired onto by another student — inside a Workmark workspace. They
plan it, break it into tasks, do the work in their own GitHub repository, and
submit tasks for checking. Workmark reads the repository as they go and turns
what actually happened into evidence an employer can check.

The point is not the board. Plenty of tools have a board. The point is the
**record of what they planned against what happened** — estimates versus
actual time, deadlines met and missed, blockers flagged early or discovered
late — and that record is only possible because a person plans in the same
place they work.

Two shapes, and the only structural difference between them is how many
people are on it:

- **Solo** — a student on their own.
- **Collaborative** — up to 4 students. Formed when someone posts a project
  listing and hires other students through the existing applications flow.

Where the idea came from is **not structural**. AI-suggested, self-started or
hired-onto all behave identically. `brief_id` and `listing_id` on `workspaces`
are provenance links and nothing else — do not branch on them.

---

## 2. Life of a project

```
draft ──(repo linked)──> active ──> submitted ──> closed
                                              └─> abandoned
```

1. Someone creates a project: **name and summary only**.
2. They link **one GitHub repository**. The database refuses to leave `draft`
   without one (`require_repo_before_starting`), because with no repo there is
   nothing to read, nothing to attribute, and no evidence at the end.
3. They pick their **work role** (backend, frontend, design…). The planner
   uses it to put tasks on the right person.
4. They invite up to 3 others. Each must **connect GitHub before accepting** —
   otherwise their commits cannot be attributed and they would do a whole
   project generating evidence for everyone but themselves.
5. The project starts. Tasks get planned, worked, submitted.
6. Submitted tasks wait for a **batch verification run**.

For a hired team, steps 1 and 4 happen automatically: the first accepted
application creates the workspace and makes the poster an owner
(`attach_engagement_to_workspace`), and later hires join the same one. **It is
still created as a draft** — somebody still has to attach the repo.

---

## 3. Architecture, and the decisions behind it

### Membership, not ownership

Every table in Workmark before this answers *"which student owns this row"*,
and every policy is a form of `auth.uid() = student_id`. That cannot express a
project two people work on, because a teammate must read rows they do not own.

So workspace tables use **membership policies**: `is_workspace_member(workspace_id)`.

Two things follow that are easy to get wrong:

- **`is_workspace_member` and `is_workspace_owner` are `SECURITY DEFINER`.**
  Not a shortcut. A policy on `workspace_members` has to ask whether the
  caller is a member, which means reading `workspace_members` — and a policy
  that reads the table it protects recurses until Postgres gives up with
  *"infinite recursion detected in policy"*. A definer function is not itself
  policed, so the recursion never starts. **Do not remove `security definer`
  from these.**
- **Every workspace-scoped table carries `workspace_id` directly**, even where
  a join through `tasks` would reach it. RLS runs per row, and a policy
  containing a subquery is the usual reason a Supabase table gets slow. One
  denormalised column buys a policy that is a single indexed function call.
  **Keep doing this on new tables.**

### Company accounts later, without a rewrite

Business accounts are **not** being built now, but three choices keep them
additive when they are:

1. **Membership points at `accounts(id)`, not `students(id)`.** Every user has
   an account row; a company user will too. Keyed on `students`, adding
   companies would mean changing the column and every policy reading it.
2. **`workspaces` has two nullable parents** (`brief_id`, `listing_id`). A
   company-posted project later fills a column that already exists.
3. **`listings.poster_type` is untouched.** It is already polymorphic
   (`student | faculty`); it later gains `organization` in its CHECK.

### Attribution is the core problem

`github_repo_grants` is **per student** — right for a personal record, wrong
for a team, where one repository has several contributors and only one of them
installed the App on it.

So `workspace_repos` holds the repo at the **workspace** level. One member
links it, everyone's commits are read through that single installation, and
contributions are matched back to people by **commit author login** →
`students.github_username`.

That column is therefore load-bearing identity. It is written only by the
GitHub App callback, and `v05_0024` revoked the student's ability to write it.
**Do not add `github_username` back to the writable column grants.**

Attribution also requires **consent**: `work_events.author_account_id` is set
only when that login maps to a member of *that workspace* who has
`scan_consent_at` set. A commit by someone who has not consented still gets a
row (it is a fact about the repository) but is stored with the login only.

### The event ledger, and why it is built before the verifier

The obvious design is to scan the repository when a task is submitted. That
pays for a full repository read **per task** and gets slower as the project
grows.

Instead GitHub tells us as things happen (`work_events`), and a submission
assembles its case from rows that already exist. Deterministic checks then run
free on top of that, and exactly one model call is spent on the judgement.

**Consequence: `work_events` must exist before verification.** Built the other
way round, every check is a repo scan and the feature is too expensive to turn
on. This is why step 2 came before the board.

### Verification runs in batches

Submitted tasks **wait** for a run rather than triggering one. The expensive
part is assembling repository context, and ten tasks submitted in a day share
nearly all of it — so one batch costs roughly what two separate checks would.
`verification_runs` groups them; `task_submissions.run_id` points at the run.

### Plan versus reality is recorded, not overwritten

An estimate edited in place destroys the fact that it was ever different.
Three tables instead of one:

- `tasks` — current state.
- `task_revisions` — every deliberate change to the plan, **with a reason**.
  This is what turns "missed the deadline" into "saw it coming four days out
  and renegotiated", which is the more valuable signal.
- `task_transitions` — every board move, written **by trigger**, never by the
  client. Time-in-column is the basis of estimate-versus-actual, and a caller
  that forgets to log a move — or shades one — would corrupt the only honest
  measurement here. Nobody is ever asked how long something took.

`started_at` records the **first** entry into Doing; moving a card back and
forward does not restart the clock.

---

## 4. Schema map

Migrations `v05_0025` → `v05_0033`.

| Table | What it holds |
|---|---|
| `workspaces` | the project — title, summary, status, deadline |
| `workspace_members` | who is on it; `role` (owner/member) **and** `work_role` (the job) |
| `workspace_repos` | the project's repository, at workspace level |
| `workspace_removal_requests` / `_approvals` | removing a contributor, by team vote |
| `sprints` | optional grouping |
| `tasks` | the plan and the current state |
| `task_dependencies` | which task blocks which |
| `task_revisions` | every change to the plan, with a reason |
| `task_transitions` | every board move, trigger-written |
| `work_events` | commits, PRs, reviews, CI — from the webhook |
| `verification_runs` | one batch check |
| `task_submissions` | one attempt at verifying a task |
| `task_checkpoints` | the short questions |
| `workspace_files` | presentation and attachment metadata (bytes in Storage) |
| `workspace_messages` | project and per-task chat |

### Rules enforced in the database, not just the UI

- A workspace cannot leave `draft` without a linked repo.
- Accepting an **invitation** requires a `github_connections` row.
- Team cap of **4**, counting unanswered invitations.
- A member cannot write their own `role` (column grant), cannot forge a
  verification verdict (insert policy pins `verdict = 'pending'`), and cannot
  move a message to another task (column grant).
- `work_events` is **read-only to every signed-in user**. An event a client
  can insert is an event a client can invent.
- **Nobody may move a card into Verified.** That is the verifier's answer; a
  board where you can mark your own work verified produces evidence worth
  nothing. Enforced in `canMoveTo` and, once the verifier exists, by the fact
  that only the service role writes a verdict.
- A task that has been started **cannot be deleted**, only moved back to
  Backlog. A task abandoned halfway is a fact about how the project went, and
  deleting it is how a board becomes a highlight reel.
- The last owner cannot leave or demote themselves.

### Removal rules

These are peers, not employees. "The owner can remove you" is the wrong rule
between students and the one most open to abuse — the creator could drop a
teammate the day before a project closes and keep the work.

| Situation | Rule |
|---|---|
| Leaving | Always allowed, by anyone |
| Removing someone who **never contributed** | An owner may, with a reason on the record |
| Removing someone who **has contributed** | Majority of the *other* members must agree |

"Contributed" is deliberately generous — one verified task or one commit
(`member_has_contributed`). The bar is "did anything at all", not "pulled
their weight". **Removal never erases evidence**; whatever they finished stays
theirs.

---

## 5. What exists in the code

```
src/lib/workspace/
  membership.ts   permission rules as pure functions (mirrors the SQL)
  queries.ts      server reads: list, load one, pending invitations
  events.ts       GitHub webhook payload → work_event rows (pure, tested)
  ingest.ts       writes those rows, resolves attribution + consent
  tasks.ts        board rules: legal moves, ordering, revisions, time-in-Doing
  verify.ts       evidence window, the four free checks, confidence ceiling
  run-verification.ts  orchestration: claim, settle, one call, write verdicts
  metrics.ts      plan vs reality: bias, spread, capability frontier (pure)
  rollup.ts       the nightly job that writes workspace_metrics

src/lib/agents/
  planner.ts      project → drafted tasks (prompt, schema, re-validation)
  verifier.ts     one call for a batch of submitted tasks

src/app/api/workspaces/
  route.ts                        POST   create a draft
  [id]/route.ts                   PATCH  edit / start
  [id]/repo/route.ts              POST   link a repo   DELETE unlink
  [id]/members/route.ts           POST   invite by handle or .edu email
  [id]/members/[account]/route.ts PATCH  accept / decline / set work role
                                  DELETE leave or remove
  [id]/tasks/route.ts             POST   create a task
  [id]/tasks/[taskId]/route.ts    PATCH  edit / move / block
                                  DELETE only from Backlog or Planned
  [id]/plan/route.ts              POST   draft a plan (one model call)
  [id]/verify/route.ts            POST   queue and run a batch check

src/app/api/cron/verify/route.ts   the nightly sweep + stuck-run recovery
src/app/api/cron/rollups/route.ts  the nightly plan-vs-reality rollup

src/app/workspaces/
  page.tsx + WorkspacesClient.tsx        list, create, answer invitations
  [id]/page.tsx + WorkspaceClient.tsx    setup, repo, role, team
  [id]/Board.tsx                         the six-column board
  [id]/PlanVsReality.tsx                 the measured figures

src/app/api/github/app/webhook/route.ts  extended to record work events
```

`membership.ts` intentionally duplicates rules that also live in SQL. The
database is the authority; the TypeScript exists so a route can answer "you
cannot do that" in a sentence and the UI can disable a button before anyone
clicks it. **If the two disagree, fix the TypeScript.**

Tests: `tests/workspace-membership.test.ts`, `tests/work-events.test.ts`,
`tests/workspace-tasks.test.ts`, `tests/planner.test.ts`,
`tests/verify.test.ts`, `tests/metrics.test.ts`.

---

## 6. What was built, and why it works that way

Six steps, in the order they had to happen. Each notes what it deliberately
left out; §7 collects all of that in one place.

### Step 1 — Projects, repos and invitations
Create a draft, link a repository, pick a work role, invite up to three
others. Invitations appear at the top of `/workspaces` — the half that gets
forgotten, and without it the whole table does nothing.

### Step 2 — The event ledger
The GitHub webhook records commits, pull requests, reviews, CI and releases
into `work_events`. Trimmed on the way in; attributed by commit author rather
than pusher, so a push containing two people's commits becomes two rows.
**Built before the verifier on purpose** — the other order makes every check a
repository scan.

### Step 3 — Tasks and the board
Six-column board, create/edit/move/delete, blockers, estimates, difficulty,
due dates, assignment, `suggested_role`, and the revision prompt on estimate
and deadline changes. Native HTML5 drag plus a select control on every card,
because drag is unreachable by keyboard and unusable on a phone. No
dependency was added for this.

Still missing from step 3, deliberately: **subtasks** (the column exists,
there is no UI), **sprints** (table exists, no UI), **dependencies** (table
exists, no UI), and **realtime**. Realtime is Supabase `postgres_changes` on
`tasks` filtered by `workspace_id` — RLS already gates it, so no new
authorization is needed. Keep drag-in-progress state out of Postgres.

### Step 4 — The planner
One model call drafts 5–12 tasks with acceptance criteria, estimates,
difficulty and a `suggested_role`. Assignment is a lookup (`assigneeForRole`),
and a task nobody matches stays unassigned rather than landing on whoever is
listed first.

**AI proposes, the student commits.** Tasks are stored `ai_proposed` and flip
to `ai_edited` the moment somebody changes the substance — title, detail,
acceptance criteria, estimate or difficulty. Moving, scheduling or reassigning
a card does not count: that is using the plan, not rewriting it. Those three
origin values are the decomposition evidence.

`tasks.plan_call_id` points at the `agent_calls` row, which is what makes "of
the nine tasks that plan suggested, how many survived" answerable.

Rate limited three ways, and the third is the one that matters:
`checkAgentRateLimit` counts rows in `agent_calls` and **fails closed**, at 6
runs per 24 hours. The other two fail open by design.

Existing task titles are sent with the request, so a second run tops the board
up instead of proposing the same eight tasks again.

Still missing: re-planning is manual only (a "Suggest more tasks" button),
there is no scheduled re-plan, and `dependsOn` comes back from the model but
is **not yet written to `task_dependencies`** — the table exists and nothing
fills it.

### Step 5 — Batch verification
Submitting queues a task; it triggers nothing. A run — manual button or the
nightly sweep — checks everything waiting at once, because the expensive part
is context and ten tasks share a repository.

**Order matters.** Claim the run, settle everything arithmetic can settle,
then spend one model call on what is left. Most submissions never reach the
call: a task with no commits is refused for free, and work marked as having
no code goes straight to a person.

Four free checks (`verify.ts`): commits, tests touched, CI conclusion,
reviewed/merged. Missing tests and absent CI are **unknown, not fail** —
saying "fail" would push students to write token tests on tasks that do not
want them.

`confidenceCeiling` caps the model afterwards: 0 with no commits, 0.5 on red
CI, 0.75 when nothing corroborates either way. The checks are facts; the
judgement sits on top. A persuasive commit message cannot talk a task past
red CI.

Verdicts are matched back **by task id, never by position** — a model that
reorders or drops one would otherwise assign somebody else's judgement to a
task, which is the worst failure available here. A task the model skips gets
no verdict rather than a guessed one.

After two failed automatic attempts a task goes to a person
(`needsHumanReview`). Verified tasks move to Verified; needs-work moves back
to Doing so the board shows outstanding work; unverifiable stays in Submitted
because it is waiting on a person, not the student.

`claim_verification_run` is a single UPDATE — the manual button and the sweep
both reach for whatever is queued, and a read-then-write has a gap where both
decide the run is theirs. A run stuck over ten minutes becomes claimable
again.

Still missing: **human verification has no UI**. `task_submissions.human_verdict`
and `human_actor_id` exist and nothing writes them, so a task that reaches
"needs a person" currently sits there. That is the first thing to build next.

### Step 6 — Plan-vs-reality rollups
A nightly job writing one row per student per project. **Never computed on
page load.** See §7.

### Not started, deliberately
Notifications (invited, assigned, verdict landed), file uploads to Supabase
Storage, checkpoints UI, the calendar, the daily queue, cross-project
capability estimates.

### Step 6 — Plan-vs-reality rollups
A nightly job (`/api/cron/rollups`) writes one `workspace_metrics` row per
person per project. **Never computed on page load** — the figures come from
every task, board move, revision and submission somebody has, which would
make the page slowest for the students who had done the most work.

Three rules hold throughout, and they are the difference between a measurement
and a scoreboard:

- **Difficulty is the multiplier.** The headline is the *capability frontier*
  — the hardest level somebody still finishes reliably — not a total.
- **A wrong estimate is studied, not punished.** Bias and spread are reported
  separately: consistently 50% under is easy to work with, randomly wrong is
  not. `estimatorProfile` says which one somebody is.
- **Nothing is reported below `MIN_SAMPLE` (4).** Every figure carries the
  sample it came from and shows "3 so far — needs a few more" rather than a
  number that looks like knowledge.

A bug worth knowing about, because the same mistake is easy to reintroduce:
`capabilityFrontier` originally walked levels 1–10, and levels above the
hardest real task had the same cumulative set as the one below, so the
frontier ratcheted through empty levels and reported **8 for somebody whose
hardest finished task was a 6**. It now iterates only difficulties actually
attempted. Overclaiming is the one direction this must never fail in.

Still missing: metrics are **per project**. Nothing aggregates them across
projects onto `/me`, and `workspace_metrics` is designed for exactly that —
`account_id` plus the lifted columns are there to be queried across rows.

---

## 7. What is left

Everything below is unbuilt. Ordered by what blocks what.

### 7.1 Operational — nothing works until these are done

- [ ] **Run migrations `0031`, `0032`, `0033`.** (`0025`–`0030` are applied.)
- [ ] **GitHub App permissions:** add **Checks** and **Issues**, both
      read-only. Then subscribe to six events: Push, Pull request, Pull
      request review, Check suite, Issue comment, Release. Until this is
      done `work_events` stays empty and verification has nothing to read.
- [ ] **Schedule `/api/cron/verify`** — nightly. Picks up runs whose request
      died partway, and queues a run for any project with work waiting that
      nobody asked about. `CRON_SECRET` in the Authorization header.
- [ ] **Schedule `/api/cron/rollups`** — nightly, *after* verify, so the
      day's verdicts are included. Same auth.

### 7.2 The gap that matters most

- [ ] **Verified work does not reach the student's record.** Nothing writes
      `skill_evidence` from a verified task. This is the whole point of the
      feature — a project produces a board full of Verified cards and none of
      it appears on `/me`. Needs a decision on how a task maps to skills
      (from changed file paths? from the project's declared skills? from the
      task text?) and it should reuse the existing evidence pipeline rather
      than growing a second one.
- [ ] **Human verification has no UI.** `task_submissions.human_verdict` and
      `human_actor_id` exist and nothing writes them, so a task that reaches
      "needs a person" — after two failed automatic attempts, or any task
      marked as having no code — sits there permanently. This is the escape
      hatch the attempt cap depends on. Build it first.

### 7.3 Tables that exist with no UI

Each of these is a migration already applied and nothing writing to it.

- [ ] **Subtasks** — `tasks.parent_task_id`
- [ ] **Sprints** — `sprints`
- [ ] **Dependencies** — `task_dependencies`. The planner already returns
      `dependsOn` and it is discarded; wiring that up is the cheapest win here.
- [ ] **Checkpoints** — `task_checkpoints`. The short before/blocked/after
      questions. Keep them rare; a workspace that interrogates you is one
      people stop opening.
- [ ] **Messages** — `workspace_messages`. Project-wide and per-task.
- [ ] **Files and presentations** — `workspace_files` holds metadata; the
      Supabase Storage bucket does not exist yet. Needs a bucket, a storage
      policy calling `is_workspace_member`, a type allowlist, a size cap and
      a malware scan.
- [ ] **Removal requests** — `workspace_removal_requests` /
      `workspace_removal_approvals`. The SQL enforces the rules; there is no
      screen to open a request or vote on one, so removing a contributor is
      currently impossible through the UI.

### 7.4 Missing behaviour

- [ ] **Closing a project out.** `workspaces.status` has `submitted` and
      `closed` and nothing moves it there. No end-of-project summary.
- [ ] **Notifications.** An invitation only appears if you visit
      `/workspaces`. Nothing emails on invited / assigned / verdict landed.
      The whole point of an invitation is reaching somebody who is *not*
      looking at the site. `src/lib/notify/email.ts` is the pattern.
- [ ] **Realtime board.** Supabase `postgres_changes` on `tasks` filtered by
      `workspace_id`. RLS already gates it, so no new authorization. Keep
      drag-in-progress state out of Postgres; if it gets hot, the migration
      path is Broadcast.
- [ ] **Calendar.** Tasks, deadlines and sprints on one timeline. Build the
      grid; do not pull in FullCalendar.
- [ ] **Daily "what to work on today".** Try plain arithmetic first — what is
      due, blocked and depended-on is a sort, not a model. Only reach for AI
      if the sorted list reads thin. A call a day per student is a bill.
- [ ] **Cross-project metrics on `/me`.** `workspace_metrics.account_id` and
      the lifted columns exist for this.
- [ ] **Scheduled re-planning.** Currently a "Suggest more tasks" button only.

### 7.5 Known limits, not bugs

- **Technical judgment is the weakest of the six dimensions.** Architecture
  decisions largely are not visible in a diff. It should carry lower
  confidence than the others and should say so.
- **`MIN_SAMPLE = 4` is unvalidated**, like every other constant here.
- **One repository per project.** More raises attribution questions nothing
  downstream is ready to answer.
- **Attribution depends on `students.github_username`** matching the commit
  author login. When `work_events.author_account_id` comes back null, that
  mismatch is almost always why.
- **`plan_call_id` is matched by a "most recent planner call for this
  student" lookup**, so two concurrent plans could mis-attribute. Only
  affects the acceptance-rate metric; documented in `planner.ts`.

---

## 8. What the metrics mean

Nothing is ever asked of the student. Every number comes from timestamps the
board already produces.

| Dimension | Built from | Key numbers |
|---|---|---|
| Execution & reliability | due dates vs completion, revisions, abandoned tasks | on-time rate; days early/late; **early-warning lead time**; recovery rate |
| Estimation & planning | estimate vs time-in-Doing | **bias** (median signed error); **spread** (median absolute error); both split by work role |
| Problem decomposition | task shapes over time | % split after starting; dependencies declared vs discovered; **AI plan acceptance rate**; tasks added after the plan |
| Technical ability | verdicts weighted by difficulty | difficulty-weighted completions; **capability frontier**; first-try CI pass rate; rework |
| Debugging | blocked episodes, retries | time-to-report; time-to-resolve; attempts before passing; CI red→green |
| Technical judgment | reviews, checkpoints | reviews given; comments that changed an outcome |

Three principles:

- **Difficulty is the multiplier.** Twenty easy tasks ≠ five hard ones. The
  headline number is the **capability frontier** — the level where someone
  stops being reliable — and it moves as they improve.
- **Wrong estimates are studied, not punished.** The `reason` on a revision is
  the point. Sorted into buckets (external dependency, scope grew, unfamiliar
  tech), the output is "underestimates unfamiliar backend work, and knows it
  within a day" rather than "bad at estimating".
- **Behaviour beats outcome when things go wrong.** A deadline missed but
  flagged four days early beats one hit silently by working a weekend.

**Anti-gaming:** nothing rewards more commits, tasks, messages or hours.
Everything is anchored to verified outcomes at increasing difficulty.

**Honest limit:** technical judgment is the weakest of the six — architecture
decisions largely are not visible in a diff. It should carry lower confidence
than the others, and should say so.

---

## 9. Open questions

- **Should the planner ever re-run on its own?** Today it is a button. A
  scheduled re-plan would be more useful and costs a call each time.
- **Does the planner re-run mid-project?** Once at the start is cheap and
  predictable. Re-planning is more useful and costs a call each time.
  Suggested: once, plus a manual "suggest more tasks".
- **Two repos on one project?** Currently one. More raises attribution
  questions nothing downstream is ready to answer.
- **Notifications.** An invitation currently only appears if you visit
  `/workspaces`. Email is probably needed — the whole point is reaching
  somebody who is not looking at the site.

---

## 10. Traps

- Do not remove `security definer` from the membership functions (recursion).
- Do not add `github_username` to writable column grants (forged identity).
- Do not compute metrics on page load (that is what the nightly rollup is for).
- A capability frontier must never be reported above the hardest difficulty
  somebody actually attempted. See §6, step 6.
- Do not let clients write `task_transitions` (the measurement stops being
  honest).
- `prefix: true` on the Projects nav tab is safe **because** `/workspaces`
  owns everything beneath it. Do not copy that flag onto `/listings` —
  `/listings/new` belongs to a different tab.
- A new agent type needs a migration — `agent_calls.agent_type` is a CHECK,
  and that friction is intended: it is the audit trail for everything that
  costs money, and a typo'd type would create a category nobody counts.
- Verdicts are matched by task id, never by array position.
- Never trust structured output without re-checking it. `normalisePlannedTask`
  exists because a task with an empty title or a 400-hour estimate would go
  straight into somebody's evidence.
- A webhook that 500s is one GitHub retries for days, against the same
  endpoint the grant sync depends on. Event ingest is wrapped in a try/catch
  and logs rather than throws. **Keep it that way.**
- `next.config.js` and `next.config.mjs` both used to exist; Next loaded one
  and silently ignored the other. There is now only `.js`.
