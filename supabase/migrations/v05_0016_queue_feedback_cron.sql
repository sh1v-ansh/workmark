-- Who was affected by an unresolved skill, feedback from users, and moving
-- the job sweeper off Vercel cron.

-- ─── Unresolved skills: say who this cost ────────────────────────────────────
-- The queue showed "'numpy' didn't match anything" and nothing else — not who
-- it happened to, not where. A reviewer couldn't tell whether it cost one
-- person a skill or forty, which is the only thing that decides whether it
-- matters.
--
-- Arrays rather than a join table: capped at 20 entries, read on every queue
-- render, never joined against. A table would be more correct and worse.

alter table unresolved_skills
  add column if not exists affected_student_ids uuid[] not null default '{}',
  add column if not exists example_repos        text[] not null default '{}',
  -- What the AI assistant concluded, if it has been asked. Advisory only:
  -- nothing here is applied without a person clicking.
  add column if not exists ai_verdict           jsonb,
  add column if not exists ai_checked_at        timestamptz;

/**
 * Record a sighting: bump the count and remember who it happened to.
 *
 * Arrays are deduped and capped in SQL rather than read-modify-write from the
 * app, so concurrent scans of different students can't lose each other's
 * entries.
 */
create or replace function record_unresolved_sighting(
  p_raw_string text,
  p_student_id uuid,
  p_repo       text
)
returns void
language sql
security definer
set search_path = public
as $$
  update unresolved_skills
     set seen_count = seen_count + 1,
         last_seen_at = now(),
         affected_student_ids = (
           select array_agg(distinct s) from unnest(
             affected_student_ids || array[p_student_id]
           ) s
         ),
         example_repos = (
           select array_agg(r) from (
             select distinct r from unnest(example_repos || array[p_repo]) r
             where r is not null limit 20
           ) t
         )
   where raw_string = p_raw_string
     and status = 'pending';
$$;

revoke all on function record_unresolved_sighting(text, uuid, text) from public, anon, authenticated;

-- ─── Feedback ────────────────────────────────────────────────────────────────
-- Bug reports and feature requests. Context is captured automatically,
-- because a student will never tell you they were on /listings/abc/applicants
-- in Safari — and without that a report is "it's broken".

create table if not exists feedback (
  id           uuid default gen_random_uuid() primary key,
  reporter_id  uuid references auth.users(id) on delete set null,
  kind         text not null check (kind in ('bug', 'feature')),
  title        text not null,
  body         text not null,
  -- Captured silently at submit time.
  page_url     text,
  user_agent   text,
  status       text not null default 'new'
               check (status in ('new', 'triaged', 'done', 'declined')),
  admin_note   text,
  resolved_by  uuid references auth.users(id),
  resolved_at  timestamptz,
  created_at   timestamptz default now() not null
);

create index if not exists feedback_open_idx on feedback (created_at desc) where status in ('new', 'triaged');

alter table feedback enable row level security;

drop policy if exists "Users: file feedback" on feedback;
create policy "Users: file feedback" on feedback
  for insert with check (auth.uid() = reporter_id);

drop policy if exists "Users: read own feedback" on feedback;
create policy "Users: read own feedback" on feedback
  for select using (auth.uid() = reporter_id);

drop policy if exists "Admins: read all feedback" on feedback;
create policy "Admins: read all feedback" on feedback
  for select using (is_admin());

-- ─── Job sweeper, moved into the database ────────────────────────────────────
-- Vercel's Hobby plan allows one cron run per day, which is useless as a
-- recovery mechanism: a scan whose self-chain was dropped would sit stalled
-- for up to 24 hours. pg_cron runs every minute on every Supabase tier.
--
-- On cost, since it's the obvious objection: the sweep is a single index
-- probe against a partial index, returning zero rows in the ordinary case.
-- It never runs scan logic — that stays in the application. Waking up 1,440
-- times a day to check one index costs nothing measurable.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Where the worker lives and how to authenticate to it. Not env vars,
-- because Postgres has none; not hardcoded, because one of these is a secret.
-- Populate once after running this migration:
--
--   insert into private_config (key, value) values
--     ('site_url', 'https://www.workmark.org'),
--     ('cron_secret', '<the same value as CRON_SECRET in Vercel>')
--   on conflict (key) do update set value = excluded.value;

create table if not exists private_config (
  key   text primary key,
  value text not null
);

alter table private_config enable row level security;
-- No policies at all: readable only by the service role and by security
-- definer functions. A config table holding a shared secret should be
-- invisible to every client, including admins in the browser.

/**
 * Nudge any job whose chain was lost.
 *
 * Safe to run at any frequency: claim_job() hands the lease to exactly one
 * caller, so a job already progressing simply refuses the extra request.
 * Fire-and-forget via pg_net — we don't need the response, only the wake-up.
 */
create or replace function sweep_stalled_jobs()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url    text;
  v_secret text;
  v_job    record;
begin
  select value into v_url    from private_config where key = 'site_url';
  select value into v_secret from private_config where key = 'cron_secret';
  if v_url is null or v_secret is null then return; end if;

  for v_job in
    select id from jobs
     where status in ('queued', 'running')
       and updated_at < now() - interval '90 seconds'
     order by updated_at
     limit 20
  loop
    perform net.http_post(
      url     := v_url || '/api/jobs/step',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_secret
      ),
      body    := jsonb_build_object('jobId', v_job.id)
    );
  end loop;
end;
$$;

revoke all on function sweep_stalled_jobs() from public, anon, authenticated;

-- Supports the sweep's exact predicate, so the common case (nothing stalled)
-- is one index probe that touches no heap pages.
create index if not exists jobs_sweep_idx
  on jobs (updated_at)
  where status in ('queued', 'running');

select cron.unschedule('workmark-sweep-jobs')
  where exists (select 1 from cron.job where jobname = 'workmark-sweep-jobs');

select cron.schedule('workmark-sweep-jobs', '* * * * *', $$select sweep_stalled_jobs()$$);

-- The taxonomy assistant is a new agent kind, and agent_calls constrains
-- which kinds may be logged. Without this its audit rows would be rejected —
-- and an unlogged agent call is worse than no agent call.
alter table agent_calls drop constraint if exists agent_calls_agent_type_check;
alter table agent_calls add constraint agent_calls_agent_type_check
  check (agent_type in ('posting', 'brief', 'goals', 'application_scoring', 'taxonomy'));

-- When an application was actually answered.
--
-- There was no way to tell. Acceptance could be inferred from the
-- engagement's opened_at, but a rejection left no trace of when it happened —
-- so "how long do posters take to reply" was unanswerable, and so was "how
-- long has this person been waiting", which is the more important half.
alter table applications add column if not exists decided_at timestamptz;

-- Backfill what can be recovered: an accepted application's engagement
-- records when it opened. Rejections before this column existed stay null
-- rather than being given a made-up timestamp.
update applications a
   set decided_at = e.opened_at
  from engagements e
 where e.application_id = a.id
   and a.decided_at is null
   and a.status = 'accepted';
