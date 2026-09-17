-- ============================================================
--  WORKMARK MIGRATION v05_0045 — the thing students talk to
--  Paste into Supabase → SQL Editor → Run. Incremental and idempotent.
--
--  Per-task threads with an agent that answers when it is named. A distinct
--  agent_type because this is the only conversational call in the product —
--  everything else here is one structured question with one structured answer
--  — and its rate limit and its share of the bill both need to be legible on
--  their own.
-- ============================================================

alter table agent_calls drop constraint if exists agent_calls_agent_type_check;
alter table agent_calls add constraint agent_calls_agent_type_check
  check (agent_type in (
    'posting', 'brief', 'goals', 'taxonomy', 'work_summary',
    'planner', 'verification', 'retro', 'kickoff', 'helper'));
