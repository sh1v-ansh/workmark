-- Plan versus reality, computed nightly and stored.
--
-- Never computed on page load. The figures come from every task, every board
-- move, every revision and every submission a person has on a project — a
-- handful of queries and a lot of arithmetic. Doing that when somebody opens
-- a page means the page is slow for exactly the students who have done the
-- most work, which is precisely backwards.
--
-- One row per person per project, overwritten each night. History is not kept
-- here: the underlying rows ARE the history, and they are immutable, so any
-- past state can be recomputed. A second copy of a derived number is a second
-- thing that can be wrong.

create table workspace_metrics (
  id            uuid default gen_random_uuid() primary key,
  workspace_id  uuid references workspaces(id) on delete cascade not null,
  account_id    uuid references accounts(id) on delete cascade not null,

  -- The whole shape, as computeMetrics returns it. jsonb rather than fifty
  -- columns because the shape will change as the measurement gets better,
  -- and a migration per metric would make improving it expensive enough that
  -- it stops happening.
  metrics       jsonb not null,

  -- Lifted out for querying: these are what a record page sorts, filters and
  -- compares across projects, and digging them out of jsonb every time would
  -- undo the point of precomputing them.
  tasks_completed        int not null default 0,
  difficulty_weighted    int not null default 0,
  capability_frontier    int,
  on_time_rate           numeric(4,3),
  estimate_bias          numeric(6,3),

  computed_at   timestamptz not null default now(),

  unique (workspace_id, account_id)
);

create index workspace_metrics_account_idx on workspace_metrics (account_id, computed_at desc);

alter table workspace_metrics enable row level security;

-- Your own numbers, wherever they are. This is the row a record page reads,
-- and it must not depend on still being on the project — somebody who
-- finished a project last term keeps what they earned.
create policy "Students: read own metrics"
  on workspace_metrics for select using (account_id = auth.uid());

-- And your teammates' on a project you are on. A team can see how the
-- project went, which is the honest reading of shared work — and it is the
-- same information they could assemble by hand from the board anyway.
create policy "Members: read metrics on their projects"
  on workspace_metrics for select using (is_workspace_member(workspace_id));

create policy "Admins: read all metrics"
  on workspace_metrics for select using (is_admin());

-- No insert or update policy for anybody. These are written by the nightly
-- rollup under the service role, and a student who could write their own
-- capability frontier could write anything.
