-- One constraint on accounts.status, not two.

-- ─── What was wrong ──────────────────────────────────────────────────────────
-- v05_0014 added a check called accounts_status_valid allowing only
-- 'active', 'suspended' and 'declined'. Every later migration that touched
-- the allowed statuses — v05_0017, v05_0018, v05_0021 — dropped and re-added
-- a *differently named* constraint, accounts_status_check, and added the new
-- values there. Nobody dropped accounts_status_valid.
--
-- Postgres enforces both. So when v05_0018 introduced 'deleting' for the
-- seven-day grace period, it was allowed by one constraint and refused by
-- the other, and every account deletion since has failed with 23514 before
-- anything was marked. The feature has never worked on this database.
--
-- The fix is to drop both by name and add back exactly one. Named once, so
-- the next migration that changes the allowed statuses has one thing to
-- replace rather than two to remember.

alter table accounts drop constraint if exists accounts_status_valid;
alter table accounts drop constraint if exists accounts_status_check;

alter table accounts add constraint accounts_status_check
  check (status in ('active', 'suspended', 'declined', 'deleting'));
