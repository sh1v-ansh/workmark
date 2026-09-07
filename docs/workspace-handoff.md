# Execution & Evidence Workspace — handoff

Everything a second person needs to pick this up. Kept current as the feature
is built; if it disagrees with the code, the code is right and this file is
stale — say so in the PR.

Last updated: tasks and the board (step 3 of 6).

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

Migrations `v05_0025` → `v05_0030`. All applied.

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

src/app/workspaces/
  page.tsx + WorkspacesClient.tsx        list, create, answer invitations
  [id]/page.tsx + WorkspaceClient.tsx    setup, repo, role, team
  [id]/Board.tsx                         the six-column board

src/app/api/github/app/webhook/route.ts  extended to record work events
```

`membership.ts` intentionally duplicates rules that also live in SQL. The
database is the authority; the TypeScript exists so a route can answer "you
cannot do that" in a sentence and the UI can disable a button before anyone
clicks it. **If the two disagree, fix the TypeScript.**

Tests: `tests/workspace-membership.test.ts`, `tests/work-events.test.ts`,
`tests/workspace-tasks.test.ts`.

---

## 6. Still to build

### Step 3 — Tasks and the board — DONE
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
One AI call turns a project into 6–12 tasks, each tagged with a
`suggested_role`. Assignment is then a lookup (`assigneeForRole`), not a
guess. **AI proposes, the student commits** — they can accept, edit, reorder,
delete, add. `tasks.origin` records which of those happened, and that is
itself evidence.

### Step 5 — Batch verification
A `verification_runs` job: gather submitted tasks, group by repo, run the free
deterministic checks (CI green? tests touched? changed paths overlap what the
task named?), then **one model call** for the judgement. Produces a confidence
score and a per-check list, never a bare yes/no. Cap at two automatic attempts
before a person decides — a board somebody cannot get a card out of is worse
than no checking.

### Step 6 — Plan-vs-reality rollups
A nightly job writing one row per student per project. **Never computed on
page load.** See §7.

### Not started, deliberately
Notifications (invited, assigned, verdict landed), file uploads to Supabase
Storage, checkpoints UI, the calendar, the daily queue, cross-project
capability estimates.

---

## 7. The metrics, for when step 6 arrives

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

## 8. Open questions

- **What triggers a batch run?** Nightly cron per active workspace, manual
  button, or both? Nightly across every active workspace is the line item that
  shows up on the Anthropic bill.
- **Does the planner re-run mid-project?** Once at the start is cheap and
  predictable. Re-planning is more useful and costs a call each time.
  Suggested: once, plus a manual "suggest more tasks".
- **Two repos on one project?** Currently one. More raises attribution
  questions nothing downstream is ready to answer.
- **Notifications.** An invitation currently only appears if you visit
  `/workspaces`. Email is probably needed — the whole point is reaching
  somebody who is not looking at the site.

---

## 9. Traps

- Do not remove `security definer` from the membership functions (recursion).
- Do not add `github_username` to writable column grants (forged identity).
- Do not compute metrics on page load (that is what the nightly rollup is for).
- Do not let clients write `task_transitions` (the measurement stops being
  honest).
- `prefix: true` on the Projects nav tab is safe **because** `/workspaces`
  owns everything beneath it. Do not copy that flag onto `/listings` —
  `/listings/new` belongs to a different tab.
- A webhook that 500s is one GitHub retries for days, against the same
  endpoint the grant sync depends on. Event ingest is wrapped in a try/catch
  and logs rather than throws. **Keep it that way.**
- `next.config.js` and `next.config.mjs` both used to exist; Next loaded one
  and silently ignored the other. There is now only `.js`.
