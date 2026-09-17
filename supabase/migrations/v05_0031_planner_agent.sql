-- The planner is a new kind of agent call.
--
-- agent_calls.agent_type is a CHECK rather than a free text column on
-- purpose — it is the audit trail for everything Workmark spends money on,
-- and a typo'd type would quietly create a category nobody is counting. So a
-- new agent means a migration, which is the intended friction.
alter table agent_calls drop constraint if exists agent_calls_agent_type_check;
alter table agent_calls add constraint agent_calls_agent_type_check
  check (agent_type in ('posting', 'brief', 'goals', 'taxonomy', 'work_summary', 'planner'));

-- Which plan a task came from, when it came from one.
--
-- tasks.origin already says whether a task was proposed, edited or written
-- by hand. This says WHICH run proposed it, which is what makes the
-- acceptance rate answerable: of the nine tasks that plan suggested, how
-- many survived, how many were edited, how many were thrown out. That ratio
-- is evidence about how the student plans, and without this column it can
-- only be guessed at from timestamps.
alter table tasks add column plan_call_id uuid references agent_calls(id) on delete set null;

create index tasks_plan_call_idx on tasks (plan_call_id) where plan_call_id is not null;
