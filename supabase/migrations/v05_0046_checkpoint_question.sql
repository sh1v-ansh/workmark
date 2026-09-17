-- ============================================================
--  WORKMARK MIGRATION v05_0046 — the question a task asks before it starts
--  Paste into Supabase → SQL Editor → Run. Incremental and idempotent.
--
--  task_checkpoints has existed since v05_0027 with nothing writing to it.
--  The missing piece was where a task-specific question lives between the
--  plan being written and the card being started.
--
--  It cannot live in task_checkpoints itself: that table requires an
--  account_id, and at plan time nobody has picked the card up yet. So the
--  question belongs to the task, and the checkpoint row is created — with an
--  owner — at the moment somebody starts.
--
--  Null is the normal case and means "ask the standard question". A
--  hand-written task never goes through the planner, and a planner call that
--  is refused or unavailable must not leave a card that cannot be started.
-- ============================================================

alter table tasks
  add column if not exists before_question text
    check (before_question is null or char_length(before_question) between 10 and 300);

comment on column tasks.before_question is
  'Asked once when this card enters Doing. Written by the planner with the task; null falls back to the standard question in lib/workspace/checkpoints.ts.';

-- The board reads a project's checkpoints on every load, and the verifier
-- reads one task's at check time.
create index if not exists task_checkpoints_task_idx
  on task_checkpoints (task_id, asked_at);
