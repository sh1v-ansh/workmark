-- The verifier is a new kind of agent call, and the most consequential one:
-- it is the only place a model decides something that lands on a student's
-- permanent record. Same reasoning as the planner in v05_0031 — agent_type
-- is a CHECK because it is the audit trail for everything that costs money,
-- and a typo would create a category nobody counts.
alter table agent_calls drop constraint if exists agent_calls_agent_type_check;
alter table agent_calls add constraint agent_calls_agent_type_check
  check (agent_type in (
    'posting', 'brief', 'goals', 'taxonomy', 'work_summary', 'planner', 'verification'
  ));

-- ─── The lease ──────────────────────────────────────────────────────────────
-- verification_runs was written as a record of a run. It now has to be a
-- queue as well, and a queue needs a way to stop two workers claiming the
-- same row — the manual button and the sweeper both reach for whatever is
-- queued, and a double run would spend twice and could write two verdicts
-- for one submission.
--
-- Same shape as jobs.locked_at, for the same reason and with the same
-- expiry: a worker that dies mid-run must not hold the row forever.
alter table verification_runs add column locked_at timestamptz;
alter table verification_runs add column attempts int not null default 0;

/**
 * Claim one run, or return nothing.
 *
 * The whole point is that this is a single statement. Reading a queued row
 * and then updating it is two statements with a gap in the middle, and that
 * gap is exactly where two workers both decide the run is theirs.
 *
 * A run is claimable when it is queued, or when it has been running for more
 * than ten minutes — long enough that any real run has finished, short
 * enough that a crash does not strand a student's submission for an hour.
 */
create or replace function claim_verification_run(p_run uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed int;
begin
  update verification_runs
     set status = 'running',
         locked_at = now(),
         started_at = coalesce(started_at, now()),
         attempts = attempts + 1
   where id = p_run
     and (status = 'queued'
          or (status = 'running' and locked_at < now() - interval '10 minutes'));
  get diagnostics v_claimed = row_count;
  return v_claimed > 0;
end;
$$;

create index verification_runs_claimable_idx
  on verification_runs (queued_at)
  where status in ('queued', 'running');
