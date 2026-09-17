-- ============================================================
--  WORKMARK MIGRATION v05_0044 — the sprint kickoff is its own agent
--  Paste into Supabase → SQL Editor → Run. Incremental and idempotent.
--
--  Sprints close with a review and start with a text box. The half that was
--  missing is the one a project manager actually earns their place doing:
--  saying "that is three weeks of work" BEFORE the week rather than after it.
--
--  A distinct agent_type rather than reusing 'retro', because the two are
--  different questions asked at different times, and folding them together
--  would make both the audit trail and the rate limit lie about what was
--  spent on what.
-- ============================================================

alter table agent_calls drop constraint if exists agent_calls_agent_type_check;
alter table agent_calls add constraint agent_calls_agent_type_check
  check (agent_type in (
    'posting', 'brief', 'goals', 'taxonomy', 'work_summary',
    'planner', 'verification', 'retro', 'kickoff'));
