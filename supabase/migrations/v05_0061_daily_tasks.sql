-- ============================================================
--  WORKMARK MIGRATION v05_0061 — daily tasks
--  Paste into Supabase → SQL Editor → Run. Incremental and idempotent.
--
--  A project can run at one of two paces, chosen when the plan is drafted:
--    daily       — a new batch of tasks every morning at 8:00 local time,
--                  with an email, like an internship
--    all_at_once — the whole plan visible from the start
--  Null means not chosen yet (no plan, or the plan was removed).
-- ============================================================

alter table public.workspaces
  add column if not exists pace text check (pace in ('daily', 'all_at_once')),
  add column if not exists timezone text,
  add column if not exists last_batch_on date;

create index if not exists workspaces_daily_pace_idx
  on public.workspaces (id) where pace = 'daily' and status = 'active';

-- Hourly, because 8:00 comes round at a different UTC hour in every
-- timezone. The route releases a batch only where it is past 8:00 locally
-- and today's batch has not gone out, so extra runs do nothing.
create or replace function request_daily_tasks()
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

  -- Nothing on a daily pace, nothing to wake.
  if not exists (select 1 from workspaces where pace = 'daily' and status = 'active') then
    return;
  end if;

  perform net.http_post(
    url     := v_url || '/api/cron/daily-tasks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body    := '{}'::jsonb
  );
end;
$$;

revoke all on function request_daily_tasks() from public, anon, authenticated;

select cron.unschedule('workmark-daily-tasks')
  where exists (select 1 from cron.job where jobname = 'workmark-daily-tasks');

-- Minute 3 of every hour, off every other job's minute.
select cron.schedule('workmark-daily-tasks', '3 * * * *', $$select request_daily_tasks()$$);
