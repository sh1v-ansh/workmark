-- ============================================================
--  WORKMARK MIGRATION v05_0038 — finished job rows expire in the database
--  Paste into Supabase → SQL Editor → Run. Incremental and idempotent.
--
--  v05_0016 moved scheduling out of Vercel Cron and into pg_cron, because
--  Vercel's Hobby plan allows one run per day and a queue sweep that runs
--  daily is not a recovery mechanism. Every scheduled job here has lived in
--  the database since.
--
--  v05_0034..0036 then re-added a Vercel Cron entry pointing at
--  /api/cron/jobs. That route's own documentation says it is "No longer on
--  Vercel Cron", so the schedule and the design disagreed. Removing the entry
--  is most of the fix, but it cannot simply be deleted: the route does three
--  things, and pg_cron only covered the first.
--
--    - kicking stalled jobs — already covered, every minute, by
--      sweep_stalled_jobs() in v05_0016
--    - recomputing calibration — moved into /api/cron/nightly, which is
--      where it belongs regardless: it reads current_skill_evidence, and the
--      nightly pass is what writes to it
--    - purging finished job rows past their keep window — this, which had no
--      schedule anywhere else
--
--  So this is the piece that would otherwise have stopped running.
--
--  Pure SQL rather than an HTTP call, following workmark-purge-rate-limits in
--  v05_0019. A delete with a fixed predicate needs no application code, and
--  routing it through pg_net would make a one-statement cleanup depend on the
--  web app being up.
-- ============================================================

-- ─── Why these rows go at all ───────────────────────────────────────────────
-- Job rows are operational telemetry, not part of a student's record — unlike
-- skill_evidence and evidence_audit, which are deliberately permanent because
-- a consumer report has to be auditable. A job's steps hold the names of a
-- student's private repositories and a line about what was found in each.
-- Once the scan is over and the evidence it produced is written, nothing
-- needs that, and holding it is data kept for no purpose.
--
-- Seven days: long enough to debug a scan that failed, short enough that a
-- repository name does not outlive the reason we read it. The same window the
-- route used, so this is a change of scheduler and not of policy.

create or replace function purge_finished_jobs()
returns void
language sql
security definer
set search_path = public
as $$
  delete from jobs
   where status in ('succeeded', 'failed', 'cancelled')
     and finished_at < now() - interval '7 days';
$$;

revoke all on function purge_finished_jobs() from public, anon, authenticated;

-- Makes the common case — a nightly delete that matches nothing — an index
-- probe rather than a scan of every job ever run. Partial, because rows still
-- in flight are never candidates and do not belong in it.
create index if not exists jobs_purge_idx
  on jobs (finished_at)
  where status in ('succeeded', 'failed', 'cancelled');

-- 51 past the hour, clear of the other daily jobs: rate limits at 03:41, the
-- workspace pass at 03:17, account purge at 04:23, recommendations at 04:41.
select cron.unschedule('workmark-purge-finished-jobs')
  where exists (select 1 from cron.job where jobname = 'workmark-purge-finished-jobs');

select cron.schedule(
  'workmark-purge-finished-jobs', '51 5 * * *',
  $$select purge_finished_jobs()$$
);
