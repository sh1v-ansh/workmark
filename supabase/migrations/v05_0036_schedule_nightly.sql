-- ============================================================
--  WORKMARK MIGRATION v05_0036 — schedule the nightly workspace pass
--  Paste into Supabase → SQL Editor → Run. Incremental and idempotent.
--
--  Scheduling lives in the database here, not in vercel.json. v05_0016 moved
--  it for a stated reason — Vercel's Hobby plan allows one cron run per day,
--  which is useless as a recovery mechanism — and everything since has
--  followed: workmark-sweep-jobs, workmark-release-waitlist,
--  workmark-purge-accounts, workmark-purge-rate-limits,
--  workmark-recommend-projects.
--
--  This adds the sixth, on the same shape: a security-definer function that
--  reads private_config and POSTs to the route through pg_net.
-- ============================================================

/**
 * Wake the nightly workspace pass.
 *
 * One call rather than three schedules, because the order inside it is a real
 * dependency and not a preference:
 *
 *   verify  ->  mint evidence  ->  roll up plan-vs-reality
 *
 * The rollups turn a day of board moves into figures, and run before the
 * day's verdicts land they would describe a day in which nothing was ever
 * verified. Three pg_cron entries staggered by a few minutes would express
 * that ordering as a hope about clock time; the route expresses it as
 * sequence.
 *
 * Fire-and-forget, like every other job here: pg_net reads nothing back and
 * the route logs its own failures. A part that fails leaves its work
 * claimable for tomorrow rather than losing it.
 */
create or replace function request_nightly_workspace_pass()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url    text;
  v_secret text;
begin
  select value into v_url    from private_config where key = 'site_url';
  select value into v_secret from private_config where key = 'cron_secret';
  if v_url is null or v_secret is null then return; end if;

  -- Nothing to do? Don't wake anything. Three cheap existence checks against
  -- indexed predicates, matching what each half of the pass would look for:
  -- work waiting to be checked, a run somebody's request abandoned, and a
  -- closed project whose record was never written.
  if not exists (select 1 from tasks where status = 'submitted')
     and not exists (select 1 from verification_runs where status in ('queued', 'running'))
     and not exists (
       select 1 from workspaces
        where status = 'closed' and evidence_minted_at is null
     )
     and not exists (select 1 from task_transitions where occurred_at > now() - interval '1 day')
  then
    return;
  end if;

  perform net.http_post(
    url     := v_url || '/api/cron/nightly',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body    := '{}'::jsonb
  );
end;
$$;

revoke all on function request_nightly_workspace_pass() from public, anon, authenticated;

-- 03:17 UTC. Off the hour and off every other job's minute, so the nightly
-- work does not all land on the same connection pool at once:
--   03:41 purge-rate-limits · 04:23 purge-accounts · 04:41 recommend-projects
--   05:07 release-waitlist
-- This one runs first because the others do not depend on it and it is the
-- only one that makes several HTTP calls of its own.
select cron.unschedule('workmark-nightly-workspace-pass')
  where exists (select 1 from cron.job where jobname = 'workmark-nightly-workspace-pass');

select cron.schedule(
  'workmark-nightly-workspace-pass',
  '17 3 * * *',
  $$select request_nightly_workspace_pass()$$
);
