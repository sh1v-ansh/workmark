# Execution & Evidence Workspace — handoff

Everything a second person needs to pick this up. Kept current as the feature
is built; if it disagrees with the code, the code is right and this file is
stale — say so in the PR.

Last updated: step 7 — the evidence loop is closed. Verified project work now
reaches the student's record, a task the checker cannot settle has somewhere to
go, and the nightly jobs are actually scheduled. **§7 is the complete list of
what is left.**

Migrations `v05_0034` and `v05_0035` are applied.

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

Plus two columns added to tables that predate all of this (`v05_0034`):
`artifacts.workspace_id` / `skill_evidence.workspace_id`, and
`workspaces.evidence_minted_at`. The last one is separate from `closed_at`
because closing and minting are separate acts — see step 7.

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
  review.ts       who may answer for a task the checker could not settle (pure)
  evidence.ts     verified project work -> skill_evidence, at close-out
  notify.ts       the five moments worth an email

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
  [id]/close/route.ts             POST   end the project, write the records
  [id]/tasks/[taskId]/review/route.ts
                                  POST   a person's answer on a stuck task

src/app/api/cron/nightly/route.ts  THE SCHEDULED ONE. verify -> mint -> roll up
src/app/api/cron/verify/route.ts   the same sweep, on its own
src/app/api/cron/rollups/route.ts  the same rollup, on its own

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
`tests/verify.test.ts`, `tests/metrics.test.ts`,
`tests/workspace-review.test.ts`, `tests/workspace-evidence.test.ts`.

`tests/schema-consistency.test.ts` is not a workspace test but will fail on
workspace work: it checks every column the app names against `schema.sql`. Add
new columns there as well as in a migration. Its write-scan also needs an
`.update({ ... })` spread over lines — a single-line object runs past its
terminator and it reports the next object literal's keys as columns.

`scripts/seed-work-events.mjs` writes the rows the webhook would, so the
submit -> check -> confirm path is testable without real GitHub traffic. It is
a fixture, not a repair tool.

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
File uploads to Supabase Storage, checkpoints UI, the calendar, the daily
queue, cross-project capability estimates.

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

### Step 7 — The evidence loop
Six steps produced a board full of Verified cards that appeared nowhere. This
step is the payoff, and it is four things that only work together.

**Human verification.** The checker leaves two kinds of task unsettled — work
marked as having no code, and work that has failed twice — and both land as
`unverifiable`, meaning "waiting on a person". `review.ts` holds the rule, and
one rule matters more than the rest: **the assignee never confirms their own
work.** Verified evidence somebody can write about themselves is worth nothing,
and this is the one path where a human answer becomes a Verified card.

A solo student therefore has nobody who is *allowed* to answer. Those go to
staff through the admin queue (a seventh adapter in `src/lib/admin/queue.ts`),
which resolves them through the same `outcomeFor` the teammate path uses — a
card must not behave differently depending on who looked at it.

**Evidence at close-out.** `mintWorkspaceEvidence` decides *who* is owed
evidence and hands each person to the existing `processRepo`. It deliberately
does not grow a second pipeline: two would mean two definitions of what a
skill level means and two places for a dispute to argue with.

Three refusals, none of them a bug: no verified work (nothing to attest to),
no `scan_consent_at` (the same gate `ingest.ts` applies), no
`github_username` (nothing to attribute).

The tier is `workspace_verified`, base 0.6, and what earns it is **not** that
the work is harder. It is that the acceptance criteria were written down
before the work started. Every other tier judges a finished repository against
itself.

`difficulty_cleared` is still whatever `computeDifficultyLevel` derives from
the repository — deliberately not raised by task difficulty, because a student
setting their own task to difficulty 9 must never be able to move their own
record. What the verified-task history buys instead is `source_agreement: 2`.

**Closing and minting are separate writes.** Closing is one fast update;
minting is a repository scan per member and can outlast 60 seconds on a
four-person team. So the close commits first and `evidence_minted_at` records
whether the slow half finished. A null there on a closed project is retried by
the nightly pass. Folded into one write, a timeout would have meant a project
that refuses to close because GitHub was slow.

**The nightly job now runs.** `/api/cron/verify` and `/api/cron/rollups`
existed and nothing scheduled them. `/api/cron/nightly` is the scheduled one
(`v05_0036`, pg_cron, like every other job here): verify, then mint, then roll
up. The order is required, not cosmetic — rollups run before the verdicts land
would describe a day in which nothing was ever verified. Three staggered
pg_cron entries would express that ordering as a hope about clock time; one
call expresses it as sequence. Both older routes stay for running a sweep on
its own.

Also in this step: the planner's `dependsOn` is finally written to
`task_dependencies` and shown as "Waiting on …" — recorded, never enforced.
And five email kinds, one digest per check rather than one per task.

### Step 8 — The record a dispute argues with

Workmark decides what goes on a student's record, which makes a dispute a
**§611 reinvestigation with a 30-day clock**, not a support ticket. That is
what `disputes`, `evidence_audit` and `src/lib/fcra/` already exist for.
Workspace evidence had no equivalent trail, and one live bug.

**The bug, which mattered more than the logging.** `reinvestigate` rescans
through the *disputing student's own* GitHub installation. Project evidence is
read through the *workspace's* installation — a teammate's. So the rescan
could not see the repository, `scanRepo` returned `skip`, and the code fell
through with `hasAttributedCommits` still false, which
`reinvestigationOutcome` reads as "the commits are not theirs" and retracts.

**A student who filed a dispute to ask a question would have had their
evidence deleted.** Two fixes: workspace evidence rescans through
`workspace_repos.installation_id`, and a **skipped scan never retracts** — it
routes to a person. The second one protects every kind of evidence, not just
this one; anybody whose repository went private had the same exposure.

**`task_decisions` (`v05_0035`).** `task_submissions.verdict` is updated in
place, so a human confirmation erased the checker's original answer. For a
dispute that is the wrong half to lose. Trigger-written, like
`task_transitions`, for the same reason: a caller that forgets to log a
decision corrupts the only record the student has to argue with. Read-only to
members; no insert policy exists, and none should.

**`task_submissions.agent_call_id` is finally populated.** The column shipped
with the verification migration and nothing ever wrote it, because the only
way to get a call id was to guess. `callStructuredAgentLogged` returns it now.
`agent_calls` already stores the full prompt, the parsed output and the model
version — so a verdict can be traced to the exact text that produced it.

**The basis is recorded and shown.** Minting writes an `evidence_audit` row
naming the tasks, their acceptance criteria, verdicts, confidence and who
confirmed them — rather than the `{artifact_id, raw_composite}` a plain scan
leaves. `/me/file` shows it (its signal query filtered `skill_source:%` and
was silently dropping the one signal that explains why project evidence
outranks a scan), and the task dialog shows the decision history.

---

## 7. What is left

Everything below is unbuilt. Ordered by what blocks what.

### 7.1 Operational — nothing works until these are done

- [x] Migrations `0025`–`0035` are applied.
- [ ] **Run migration `v05_0036`.** Schedules the nightly workspace pass in
      pg_cron. Until it runs, verification only happens when somebody presses
      the button, and no closed project's evidence is ever retried.
- [x] GitHub App permissions and the six event subscriptions are set.
**Scheduling lives in pg_cron, not `vercel.json`.** `v05_0016` moved it there
and said why: Vercel's Hobby plan allows one cron run per day, which is
useless as a recovery mechanism, while pg_cron runs every minute on every
Supabase tier. Every scheduled job since has followed the same shape — a
`security definer` function that reads `site_url` and `cron_secret` from
`private_config` and **POSTs** to its route through `pg_net`.

That is why every `/api/cron/*` route here is a POST handler. Do not "fix"
one to GET for Vercel Cron; nothing calls them that way.

    workmark-sweep-jobs              * * * * *   v05_0016
    workmark-nightly-workspace-pass  17 3 * * *  v05_0036
    workmark-purge-rate-limits       41 3 * * *  v05_0019
    workmark-purge-accounts          23 4 * * *  v05_0018
    workmark-recommend-projects      41 4 * * *  v05_0022
    workmark-release-waitlist         7 5 * * *  v05_0017

`vercel.json` still carries `/api/cron/jobs` and that is the only entry in it.

**`private_config` must be populated** or every one of these returns silently.
See the block at the top of `v05_0016`.

**Watch `maxDuration`.** A deployment whose value exceeds the plan limit
**fails to build** rather than being clamped. 60 is safe on every plan; the
verify and rollup routes shipped at 300, which is fine on Pro and breaks a
Hobby deploy, and nothing in the repo settles which plan this is. They are at
60 now with the sweep bounded to match — raise both together if the project
is on Pro.

### 7.2 The gap that mattered most — closed

Both items are done; see step 7. What is worth knowing about how:

- Verified work reaches the record **at close-out**, not per task. A repo scan
  per verified task would be dozens of GitHub round trips for a picture that
  barely changes between them.
- Skills come from the existing scan pipeline restricted to files that person
  touched, **not** from task text. Task text is a claim; changed files are a
  fact.
- Human verification exists in two places on purpose: teammates first, staff
  as the backstop. Both go through `outcomeFor`.

What is still thin here:

- [ ] **Nothing re-mints when a record should change.** A project closed
      before a member connected GitHub, or before they consented, is stamped
      `evidence_minted_at` and never revisited. The skip reasons are recorded
      per member in the close response but not stored, so nothing can offer
      "three people were skipped, want to try again".
- [ ] **`workspace_verified` base 0.6 is unvalidated**, like every other
      constant here. It says this evidence outranks listing-driven work. That
      is defensible and it is still a guess.
- [ ] **`reinvestigate` does not reconsider the tasks.** It rescans the
      repository, which is the right check for a scan-derived row and only
      half the story for a project one: the acceptance criteria, the verdicts
      and the human confirmations are now recorded in `evidence_audit` and
      nothing reads them back. A dispute on project evidence gets a repo
      answer to a project claim.
- [ ] **Nothing shows a student their own `task_decisions` outside a project
      they can still open.** After a workspace is deleted the log cascades
      with it. That is probably right, and it is worth deciding on purpose.

### 7.3 Tables that exist with no UI

Each of these is a migration already applied and nothing writing to it.

- [ ] **Subtasks** — `tasks.parent_task_id`
- [ ] **Sprints** — `sprints`
- [x] **Dependencies** — `task_dependencies`. The planner's `dependsOn` is
      written on plan, and shown on the card as "Waiting on …". Recorded,
      never enforced: a board that refuses moves is a board people work
      around, and "declared a dependency, then hit a different one" is the
      more interesting fact. Only the planner writes these — there is still
      no UI for adding one by hand, which is what the decomposition metric
      wants in order to compare declared against discovered.
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

- [x] **Closing a project out.** An owner closes; the summary panel replaces
      the board with what the project produced. `submitted` as a workspace
      status is still unused — nothing moves a project there, and it is not
      obvious it should exist.
- [x] **Notifications.** Five kinds: invited, assigned, verdict, review
      needed, closed. One digest per check rather than one per task — a batch
      that emails five times is a batch people mute, and then the message
      that needed them gets muted with it. Only `workspace_invited` is
      essential; the rest are switchable.
- [ ] **Nothing chases a stale review.** A task waiting on a teammate emails
      once and then waits forever. It reaches the admin queue, where its age
      is visible, and that is the only backstop.
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

### 7.6 Found by the walkthrough, still open

`tests/workspace-e2e.test.ts` drives create → plan → submit → check → confirm →
close against a real database and repository. Run it deliberately:

    WORKMARK_E2E=1 E2E_STUDENT_ID=… E2E_REPO=owner/name \
      E2E_INSTALLATION=… E2E_LOGIN=… npx vitest run tests/workspace-e2e.test.ts

It counts the student's record before and after and fails if the two differ,
and it deletes `RESEND_API_KEY` from its own environment so a run cannot email
a real person about a project that exists for nine seconds.

- [ ] **`RESEND_API_KEY` is rejected by Resend.** The walkthrough logged
      `401 … "API key is invalid"`. The key is well-formed (`re_`, 36 chars),
      so it has been revoked or belongs to another account — this is not a
      placeholder. **Check what Vercel has**, because if production carries
      the same value then every transactional email in Workmark is failing
      right now: acceptance, rejection, work submitted, engagement closed, and
      all five workspace kinds.

      The reason nobody noticed is by design and worth keeping in mind.
      `email.ts` is best-effort and never blocks the action that triggered it,
      which is right — an acceptance that 500s because a notification bounced
      is worse than an acceptance nobody was emailed about. But it means a
      completely dead mailer is invisible outside server logs. Worth routing
      repeated send failures into `error_log`, which the admin console already
      surfaces.

- [ ] **The walkthrough proves the mailer is *called*, not that it works.**
      It disables sending on purpose. Nothing tests that an email arrives.

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
- **Scheduling is pg_cron, not Vercel cron** (`v05_0016` moved it and says
  why). pg_net POSTs, which is why every `/api/cron/*` route is a POST
  handler. Converting one to GET for Vercel Cron breaks it, and nothing
  reports the breakage — the job simply stops running.
- **A new scheduled job needs a migration**, not a `vercel.json` edit: a
  `security definer` function reading `private_config`, plus a
  `cron.schedule`. Copy `request_account_purge` in `v05_0018`.
- **`maxDuration` above the plan limit fails the build**, it is not clamped.
  60 is safe everywhere.
- **The assignee never confirms their own work** (`canReview`). It is the only
  thing standing between "verified evidence" and "evidence a student wrote
  about themselves". A future "solo students can self-confirm" convenience
  would quietly destroy the value of every Verified card in the product.
- **Task difficulty must never raise `difficulty_cleared`.** Students set
  their own difficulty. Wiring it into evidence would let anyone move their
  own record by typing a 9.
- Do not add a second evidence pipeline. `processRepo` is the one place that
  decides prior-versus-evidence, dedup and audit; a parallel path means two
  definitions of a skill level and two things for a dispute to argue with.
- `tests/schema-consistency.test.ts` reads `schema.sql`, so a new column needs
  adding **there** as well as in a migration. Its write-scan also stops at the
  first `\n  }` — keep `.update({ ... })` objects spread over lines or it
  reads the next object literal's keys as column names.
