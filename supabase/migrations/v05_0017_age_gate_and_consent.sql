-- Age at signup, and holding an account until it can legally exist.

-- ─── Date of birth ───────────────────────────────────────────────────────────
-- Collected because a Workmark account creates a binding agreement and,
-- for students, a consumer report about a real person. Neither is something
-- a minor can enter into, and several states impose extra duties around
-- minors' data that this platform is not set up to meet.
--
-- Stored as a date rather than a computed "is over 18" flag, because a flag
-- is wrong the day after it's written. The date is the fact; the age is
-- derived from it whenever anyone asks.

alter table accounts add column if not exists date_of_birth date;

-- ─── Waitlisted ──────────────────────────────────────────────────────────────
-- A seventeen-year-old freshman is the exact person this product is built
-- for, and turning them away permanently over a birthday two months out
-- would be absurd. So an under-18 signup is held, not refused: the profile
-- is saved, the account exists, and it opens by itself on their eighteenth
-- birthday. Nothing about their record is built or shown before then — no
-- scanning, no applications, no disclosure — which is the part the age
-- requirement is actually about.
--
-- 'waitlisted' joins the existing statuses rather than getting its own
-- column, because every authorization path already asks "is this active",
-- and a held account is simply not active. getAccount() refuses it without
-- needing to learn a new concept.

alter table accounts drop constraint if exists accounts_status_check;
alter table accounts add constraint accounts_status_check
  check (status in ('active', 'suspended', 'declined', 'waitlisted'));

-- Supports the release sweep below, which is otherwise a full scan of
-- accounts every night for the sake of a handful of rows.
create index if not exists accounts_waitlist_idx
  on accounts (date_of_birth)
  where status = 'waitlisted';

/**
 * Open every held account whose eighteenth birthday has arrived.
 *
 * Deliberately narrow: it only ever moves 'waitlisted' to 'active', so it
 * can never resurrect an account somebody suspended or a faculty claim
 * somebody declined.
 */
create or replace function release_waitlisted_accounts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update accounts
     set status = 'active', updated_at = now()
   where status = 'waitlisted'
     and date_of_birth is not null
     and date_of_birth <= current_date - interval '18 years';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function release_waitlisted_accounts() from public, anon, authenticated;

-- Once a day is the right cadence: the thing being waited on is a birthday,
-- and nobody's birthday arrives twice. The held page also runs this check
-- on demand when the person visits, so someone who logs in on the morning
-- of their birthday isn't told to wait until the small hours.
select cron.unschedule('workmark-release-waitlist')
  where exists (select 1 from cron.job where jobname = 'workmark-release-waitlist');

select cron.schedule('workmark-release-waitlist', '7 5 * * *', $$select release_waitlisted_accounts()$$);
