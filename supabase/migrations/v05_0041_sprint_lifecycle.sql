-- ============================================================
--  WORKMARK MIGRATION v05_0041 — a sprint that can be closed, and what it
--  taught
--  Paste into Supabase → SQL Editor → Run. Incremental and idempotent.
--
--  `sprints` has existed since v05_0027 with a name, a goal and two dates,
--  and nothing has ever written to it. The dates alone cannot answer the two
--  questions the feature exists for:
--
--    - Is this sprint over? ends_on passing is not the same as somebody
--      having looked at what happened. A sprint nobody closed is a sprint
--      with no retro, and the retro is the entire product value here.
--    - What came out of it? Without somewhere to put that, the review is a
--      screen you read once and lose.
-- ============================================================

-- ─── When somebody actually ended it ────────────────────────────────────────
-- Separate from ends_on, which is a plan. A sprint that ran two days over is
-- ordinary and worth being able to see; collapsing the two would erase it.
alter table sprints add column if not exists closed_at timestamptz;

comment on column sprints.closed_at is
  'When the team reviewed this sprint. ends_on is the plan; this is what happened.';

-- ─── What it taught ─────────────────────────────────────────────────────────
-- Written once, at close, and then immutable in practice. Kept as prose
-- rather than a structured verdict because the reader is a student deciding
-- what to do next week, not a metric.
--
-- The figures behind it are not duplicated here — they are already derivable
-- from task_transitions and task_revisions, and a stored copy would drift
-- from the tables it was computed out of.
alter table sprints add column if not exists retro text;

-- Which model call produced it, so a retro traces to the exact prompt and
-- response, the same way task_submissions.agent_call_id does for a verdict.
alter table sprints add column if not exists retro_call_id uuid
  references agent_calls(id) on delete set null;

-- ─── One open sprint per project ────────────────────────────────────────────
-- Two running at once is not a thing a four-person student project needs, and
-- it makes "which sprint is this task in" a question with no good answer.
-- Enforced here rather than in the API, because the API is one of several
-- ways a row could arrive.
create unique index if not exists sprints_one_open_idx
  on sprints (workspace_id)
  where closed_at is null;

-- The board asks for this project's sprints newest first on every load.
create index if not exists sprints_workspace_idx
  on sprints (workspace_id, starts_on desc);

-- ─── The retro is a new agent kind ──────────────────────────────────────────
-- agent_calls constrains agent_type, so the audit insert fails — and with it
-- the whole call — until this is widened. Same pattern as every previous
-- agent added to this codebase.
alter table agent_calls drop constraint if exists agent_calls_agent_type_check;
alter table agent_calls add constraint agent_calls_agent_type_check
  check (agent_type in (
    'posting', 'brief', 'goals', 'taxonomy', 'work_summary',
    'planner', 'verification', 'retro'));
