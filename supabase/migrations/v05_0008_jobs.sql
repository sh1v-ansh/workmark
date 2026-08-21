-- Background jobs.
--
-- Everything slow in this product — scanning a student's repos, re-running
-- a scan to settle a dispute, generating a project brief — was being done
-- inside the request that triggered it. That fails two ways: the student is
-- pinned to the page while it runs, and a serverless function has a hard
-- timeout that a multi-repo scan simply exceeds, killing the work partway
-- with no way to resume.
--
-- A job is a list of independent STEPS plus a cursor. A worker claims the
-- job, does exactly ONE step, records it, and hands back. No single request
-- ever has to finish the whole thing, so the platform timeout stops being a
-- correctness problem and becomes a per-step budget that is trivially met.
--
-- Progress is stored rather than inferred so the UI can show "3 of 7" and
-- name the repo currently being read — and so it survives the student
-- closing the tab, which is the entire point.

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,

  -- Extensible on purpose: scan is the first consumer, but close-out
  -- evidence and dispute reinvestigation are the same shape of problem.
  kind text not null check (kind in ('github_scan')),

  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),

  -- The work list. Each entry: { id, label, status, detail }, where status
  -- is pending | running | done | failed. Kept as one document rather than
  -- a child table because steps are only ever read and written together,
  -- as a unit, by the worker that owns the job's lease.
  steps jsonb not null default '[]'::jsonb,
  total_steps int not null default 0,
  completed_steps int not null default 0,

  -- Whatever the finished job wants to tell the user. Shape is per-kind.
  result jsonb,
  error text,

  -- Lease. A worker may only touch a job whose lease is free or expired;
  -- this is what stops the self-chained call and the cron sweeper from
  -- both running step 4 at the same time and double-writing evidence.
  locked_at timestamptz,
  attempts int not null default 0,

  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);

-- The sweeper's query: unfinished jobs, oldest first.
create index if not exists jobs_pending_idx
  on jobs (status, updated_at)
  where status in ('queued', 'running');

-- "Do I already have a scan running?" on every page load.
create index if not exists jobs_student_kind_idx
  on jobs (student_id, kind, status);

alter table jobs enable row level security;

-- Students read their own jobs and nothing else. There is deliberately no
-- insert or update policy: a job is created and advanced by the server
-- under service-role. A client that could write its own job rows could
-- claim work was done that never ran, which would put unearned evidence on
-- a record — the one thing this product cannot allow.
create policy "Students: read own jobs"
  on jobs for select using (auth.uid() = student_id);

/**
 * Atomically claim a job for one step of work.
 *
 * Returns the job row on success and no rows if it could not be claimed —
 * because it is already finished, or because another worker holds a live
 * lease. Callers must treat "no rows" as "someone else has it", not as an
 * error: with a self-chaining worker AND a cron sweeper, losing the race is
 * the normal, healthy case.
 *
 * The lease expires rather than being explicitly released, so a worker that
 * is killed mid-step (the exact failure this whole table exists to survive)
 * frees its job automatically instead of stranding it forever.
 */
create or replace function claim_job(p_job_id uuid, p_lease_seconds int default 120)
returns setof jobs
language sql
security definer
set search_path = public
as $$
  update jobs
     set locked_at = now(),
         attempts = attempts + 1,
         status = case when status = 'queued' then 'running' else status end,
         started_at = coalesce(started_at, now()),
         updated_at = now()
   where id = p_job_id
     and status in ('queued', 'running')
     and (locked_at is null or locked_at < now() - make_interval(secs => p_lease_seconds))
  returning *;
$$;

revoke all on function claim_job(uuid, int) from public, anon, authenticated;
