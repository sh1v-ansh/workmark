-- ============================================================
--  WORKMARK MIGRATION v05_0039 — remember what has already been chased
--  Paste into Supabase → SQL Editor → Run. Incremental and idempotent.
--
--  Two nightly checks need to know whether they have already spoken, so that
--  a thing which stays stuck is mentioned once rather than every night. An
--  email that arrives nightly about the same card is one people filter, and
--  they filter the whole sender, which takes the messages that mattered with
--  it.
--
--  Both markers live on the row the check is about rather than in a
--  notifications table, because in both cases the question is "has anybody
--  been told about THIS" and the answer has exactly one writer.
-- ============================================================

-- ─── 1. A review nobody has answered ────────────────────────────────────────
-- A submission the checker could not settle waits on a teammate. Today it is
-- emailed once, the moment the verdict lands, and then waits forever — the
-- admin queue is the only backstop, and a solo student's card sits there
-- until staff notice.
--
-- Nullable and never backfilled. A null means "not chased yet", which is the
-- truth for every row that exists now.
alter table task_submissions
  add column if not exists review_chased_at timestamptz;

comment on column task_submissions.review_chased_at is
  'When the team was last reminded this is waiting on a person. Null means never.';

-- The sweep''s exact predicate: unsettled, unanswered, never chased. Partial
-- so it indexes the handful of stuck rows rather than every submission ever
-- made — the common case is a table where almost nothing matches.
create index if not exists task_submissions_stale_review_idx
  on task_submissions (submitted_at)
  where verdict = 'unverifiable'
    and human_verdict is null
    and review_chased_at is null;

-- ─── 2. A board that has run dry ────────────────────────────────────────────
-- A project with nothing left to do is a project that has quietly stopped,
-- and the student is the last to notice because there is no empty-board
-- moment in a tool you have closed the tab on.
--
-- Deliberately a marker for a nudge and not for a plan. Nothing here writes
-- tasks: see the note in lib/workspace/attention.ts on why the planner is not
-- run on a schedule.
alter table workspaces
  add column if not exists replan_nudged_at timestamptz;

comment on column workspaces.replan_nudged_at is
  'When the owner was last told this board is running out of work. Null means never.';

create index if not exists workspaces_active_idx
  on workspaces (status)
  where status = 'active';
