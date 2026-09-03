-- Agreeing to the terms, and leaving.

-- ─── What someone agreed to, and when ────────────────────────────────────────
-- Replaces collecting a date of birth from everybody. Asking for a birthday
-- is the more thorough-looking option and the worse one: it puts a piece of
-- sensitive personal data in the database for every single account in order
-- to answer one yes/no question, and under COPPA-style rules knowing
-- someone's age is what creates the duty in the first place. Every
-- comparable platform — LinkedIn, OpenAI, Handshake — states a minimum age
-- in the terms and takes the signup as the representation. So do we.
--
-- date_of_birth (v05_0017) stays, but is now only populated when someone
-- volunteers it because they're under 18 and want their place held. Most
-- rows will be null forever, which is the point.

alter table accounts
  add column if not exists terms_accepted_at    timestamptz,
  add column if not exists terms_version        text,
  -- Separate from terms_accepted_at on purpose: the age representation is
  -- its own statement, and if the terms are ever amended and re-accepted,
  -- when they told us they were an adult should not silently move.
  add column if not exists age_attested_at      timestamptz,
  add column if not exists deletion_requested_at timestamptz;

-- Existing accounts predate the checkbox. Recording their signup as the
-- moment of acceptance would be inventing a fact, so they stay null and
-- get asked once, the next time it matters.

-- ─── Deletion ────────────────────────────────────────────────────────────────
-- 'deleting' is a real account in a seven-day grace period. Like every other
-- non-active status it means "not active", so getAccount() refuses it
-- without learning anything new; only the routing cares which one it is.
--
-- The grace period is not politeness. The dangerous version of this feature
-- is the one where somebody who briefly gets into your session can destroy
-- your record instantly and irreversibly.

alter table accounts drop constraint if exists accounts_status_check;
alter table accounts add constraint accounts_status_check
  check (status in ('active', 'suspended', 'declined', 'waitlisted', 'deleting'));

create index if not exists accounts_deleting_idx
  on accounts (deletion_requested_at)
  where status = 'deleting';

/**
 * Proof that a deletion was asked for and carried out.
 *
 * Deliberately holds nothing about the person: an opaque user id and three
 * timestamps. It exists so "did you actually delete my account when I asked
 * in March" has an answer, which is the one question a deletion log needs to
 * survive to answer — and it survives precisely because there is no foreign
 * key here. An FK to auth.users would cascade this row away at the moment it
 * became useful.
 */
create table if not exists account_deletions (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid not null,
  requested_at timestamptz not null,
  purged_at    timestamptz,
  restored_at  timestamptz,
  -- Free-text: how it ended, and anything the purge could not do (a GitHub
  -- installation that was already gone, say).
  note         text
);

create index if not exists account_deletions_pending_idx
  on account_deletions (requested_at)
  where purged_at is null and restored_at is null;

alter table account_deletions enable row level security;
-- No policies: service role only. A user reading this table would learn
-- which other accounts have left, which is nobody's business.

-- ─── Nightly purge ───────────────────────────────────────────────────────────
-- Same shape as the job sweeper: pg_cron can't call GitHub to revoke the App
-- installation, so it wakes the application, which can. Runs daily because
-- the thing being waited on is a seven-day clock.

create or replace function request_account_purge()
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

  -- Nothing due? Don't wake anything.
  if not exists (
    select 1 from accounts
     where status = 'deleting'
       and deletion_requested_at < now() - interval '7 days'
  ) then
    return;
  end if;

  perform net.http_post(
    url     := v_url || '/api/cron/purge-accounts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body    := '{}'::jsonb
  );
end;
$$;

revoke all on function request_account_purge() from public, anon, authenticated;

select cron.unschedule('workmark-purge-accounts')
  where exists (select 1 from cron.job where jobname = 'workmark-purge-accounts');

select cron.schedule('workmark-purge-accounts', '23 4 * * *', $$select request_account_purge()$$);
