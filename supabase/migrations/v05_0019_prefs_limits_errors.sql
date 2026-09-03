-- Email preferences, rate limits, and somewhere for errors to go.

-- ─── Email preferences ───────────────────────────────────────────────────────
-- Four notification kinds are sent today and there was no way to stop any of
-- them. That's a CAN-SPAM problem, but the practical problem is worse: the
-- only lever a student had was to mark the mail as spam, and a young sending
-- domain does not survive much of that.
--
-- Preferences live as jsonb rather than five boolean columns because the set
-- of notifications will change and a migration per notification is silly. An
-- absent key means on, so a new notification kind is on by default without
-- backfilling every row.

alter table accounts
  add column if not exists notification_prefs   jsonb not null default '{}'::jsonb,
  add column if not exists email_unsubscribed_at timestamptz,
  -- Lets an unsubscribe link work from inside an email client with no
  -- session. Random and per-account, so it reveals nothing and unsubscribes
  -- nobody else. Rotating it invalidates old links, which is why it isn't
  -- just the user id.
  add column if not exists unsubscribe_token    uuid default gen_random_uuid();

update accounts set unsubscribe_token = gen_random_uuid() where unsubscribe_token is null;

create unique index if not exists accounts_unsubscribe_token_idx
  on accounts (unsubscribe_token);

-- ─── Rate limits ─────────────────────────────────────────────────────────────
-- Nothing was limited. The AI routes cost real money per call and were
-- reachable by anyone with a session; the scan routes hammer GitHub's rate
-- limit on the App's behalf, which is shared across every user.
--
-- Fixed windows in Postgres rather than a sliding log or an external store.
-- A sliding window is more correct at the boundary and needs a row per
-- request; this needs one row per (who, what) that gets overwritten. At this
-- size the difference in accuracy is irrelevant and the difference in write
-- volume is not.

create table if not exists rate_limits (
  -- 'agent:brief:<user-uuid>' — the caller decides the shape.
  key           text primary key,
  window_start  timestamptz not null default now(),
  count         int not null default 0
);

alter table rate_limits enable row level security;
-- No policies: service role only. A client that could read this could map
-- who is doing what and how often.

/**
 * Count one request against a limit; return whether it's allowed.
 *
 * One statement, one round trip, one row touched. The upsert both resets an
 * expired window and increments a live one, so there is no read-then-write
 * race between two concurrent requests from the same person.
 *
 * Returns the remaining allowance and when the window resets, because a
 * refusal that can't say "try again in 40 seconds" is a worse refusal.
 */
create or replace function check_rate_limit(
  p_key            text,
  p_limit          int,
  p_window_seconds int
)
returns table (allowed boolean, remaining int, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count  int;
  v_start  timestamptz;
begin
  insert into rate_limits (key, window_start, count)
       values (p_key, now(), 1)
  on conflict (key) do update
     set count = case
                   when rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
                   then 1
                   else rate_limits.count + 1
                 end,
         window_start = case
                   when rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
                   then now()
                   else rate_limits.window_start
                 end
  returning rate_limits.count, rate_limits.window_start into v_count, v_start;

  return query select
    v_count <= p_limit,
    greatest(p_limit - v_count, 0),
    v_start + make_interval(secs => p_window_seconds);
end;
$$;

revoke all on function check_rate_limit(text, int, int) from public, anon;

-- Abandoned keys (someone who used a route once and never again) would
-- accumulate forever otherwise. Cheap: a partial-free index scan on a small
-- table, once a day.
create index if not exists rate_limits_window_idx on rate_limits (window_start);

select cron.unschedule('workmark-purge-rate-limits')
  where exists (select 1 from cron.job where jobname = 'workmark-purge-rate-limits');

select cron.schedule(
  'workmark-purge-rate-limits', '41 3 * * *',
  $$delete from rate_limits where window_start < now() - interval '2 days'$$
);

-- ─── Error log ───────────────────────────────────────────────────────────────
-- Until now a production 500 was invisible unless a user mentioned it.
--
-- Deliberately in Postgres and surfaced in the admin console rather than
-- sent to a third party. Not because a hosted error tracker is worse — it
-- has stack traces, source maps and alerting that this doesn't — but
-- because error payloads on this platform routinely contain a student's
-- repo names and skill data, and shipping those to a fourth processor is a
-- privacy-policy change, not a config change. This is the version that can
-- ship today. Swapping in Sentry later is one module.

create table if not exists error_log (
  id          uuid default gen_random_uuid() primary key,
  -- 'server' | 'client'. Client errors arrive from the error boundary.
  source      text not null check (source in ('server', 'client')),
  -- Route or component that failed, for grouping.
  context     text not null,
  message     text not null,
  stack       text,
  user_id     uuid,
  page_url    text,
  user_agent  text,
  -- Bumped when the same context+message recurs, so one broken page doesn't
  -- produce ten thousand rows and drown everything else.
  seen_count  int not null default 1,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index if not exists error_log_group_idx on error_log (source, context, md5(message));
create index if not exists error_log_open_idx on error_log (last_seen desc) where resolved_at is null;

alter table error_log enable row level security;

drop policy if exists "Admins: read errors" on error_log;
create policy "Admins: read errors" on error_log
  for select using (is_admin());

/**
 * Record an error, collapsing repeats into a count.
 *
 * security definer so the app can write without a policy that would also
 * let a client forge entries. The unique index does the grouping.
 */
create or replace function record_error(
  p_source     text,
  p_context    text,
  p_message    text,
  p_stack      text,
  p_user_id    uuid,
  p_page_url   text,
  p_user_agent text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into error_log (source, context, message, stack, user_id, page_url, user_agent)
       values (p_source, p_context, left(p_message, 2000), left(p_stack, 8000), p_user_id, p_page_url, left(p_user_agent, 500))
  on conflict (source, context, md5(message)) do update
     set seen_count = error_log.seen_count + 1,
         last_seen  = now(),
         -- A recurrence after somebody marked it resolved is a reopen.
         resolved_at = null;
$$;

revoke all on function record_error(text, text, text, text, uuid, text, text) from public, anon;
