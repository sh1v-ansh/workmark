-- Under-18 signups are refused, not held.
--
-- v05_0017 built the opposite: a signup under 18 saved the profile, held the
-- account, and opened it on the eighteenth birthday. It was the kinder
-- design and it was in direct conflict with the Terms of Service, which say
-- people under 18 may not use or register for the Services at all.
--
-- A product whose own legal documents contradict its behaviour has a worse
-- problem than a missing feature, and the contradiction is not fixable by
-- wording — either minors can register or they cannot. They cannot. So the
-- machinery goes, along with the date of birth it existed to store: with no
-- hold to schedule, that column would be sensitive data kept for no purpose,
-- which is the exact thing not asking everybody for a birthday avoided.
--
-- Safe to run whether or not v05_0017 was ever applied.

-- Nothing to release any more.
select cron.unschedule('workmark-release-waitlist')
  where exists (select 1 from cron.job where jobname = 'workmark-release-waitlist');

drop function if exists release_waitlisted_accounts();
drop index if exists accounts_waitlist_idx;

-- Pre-launch, so there is nothing to migrate. The guard is here anyway: an
-- account that somehow reached 'waitlisted' becomes suspended rather than
-- silently active, so a person decides rather than a migration.
update accounts set status = 'suspended' where status = 'waitlisted';

alter table accounts drop constraint if exists accounts_status_check;
alter table accounts add constraint accounts_status_check
  check (status in ('active', 'suspended', 'declined', 'deleting'));

alter table accounts drop column if exists date_of_birth;
