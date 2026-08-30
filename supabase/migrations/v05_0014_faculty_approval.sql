-- Faculty is self-declared, then confirmed — and the difference is visible.
--
-- The original design let anyone declare themselves faculty and worked on
-- the principle that lying gained nothing: an unverified faculty account
-- functioned normally, verification only decided how much weight their
-- attestations carried, and so nobody waited on us. That reasoning was sound
-- but incomplete. `faculty_verified_at` was recorded, computed into the
-- session, and then never displayed anywhere — so the distinction existed in
-- the database and nowhere a person could see it. An unconfirmed claim and a
-- confirmed one looked identical.
--
-- So the account opens immediately, as before, and the claim is shown as
-- pending until someone confirms it. Nobody is blocked waiting on us, and
-- nobody is misled in the meantime. What this migration adds is the two
-- things that were missing: when they asked, and a way to say no.

-- When they asked. Distinct from faculty_verified_at, which is when someone
-- said yes — the gap between the two is how long a professor waited, and
-- that is the number worth watching once real people are queued behind it.
alter table accounts
  add column if not exists faculty_requested_at timestamptz;

update accounts
   set faculty_requested_at = coalesce(faculty_requested_at, created_at)
 where 'faculty' = any(roles)
   and faculty_requested_at is null;

-- 'declined' is a refused faculty claim.
--
-- Declining used to rewrite the account to `roles = ['student']`, which is
-- wrong in a way worth spelling out: someone who asked to be faculty and was
-- told no would silently receive a student account they never asked for,
-- with a student record and a place in the matching pool. A refusal should
-- close the claim, not quietly grant a different one.
--
-- Like 'suspended', it is simply "not active", so has_role() and getAccount()
-- already refuse it without either of them needing to learn a new value.
alter table accounts drop constraint if exists accounts_status_check;
alter table accounts drop constraint if exists accounts_status_valid;

alter table accounts
  add constraint accounts_status_valid check (
    status in ('active', 'suspended', 'declined')
  );

-- Faculty whose claim nobody has looked at yet. This is the admin queue's
-- query, and it is small and read on every admin page load.
create index if not exists accounts_faculty_unverified_idx
  on accounts (faculty_requested_at)
  where faculty_verified_at is null;
