-- Let faculty post.
--
-- A faculty account could log in and do nothing a student couldn't: the
-- database rejected any listing whose poster_type wasn't 'student', so the
-- account type existed and meant nothing.
--
-- Widening the constraint is the whole change on the schema side. The tier
-- widens with it: a faculty project is course or research work, which is a
-- different thing from one student hiring another and is weighted
-- differently once attestation exists.
--
-- 'company' is deliberately NOT added. Businesses need domain verification,
-- permissible-purpose certification and payments before their first listing,
-- and adding the value now would let one exist before any of that does.

alter table listings drop constraint if exists listings_poster_type_check;
alter table listings add constraint listings_poster_type_check
  check (poster_type in ('student', 'faculty'));

alter table listings drop constraint if exists listings_tier_check;
alter table listings add constraint listings_tier_check
  check (tier in ('listing_driven', 'faculty_project'));

-- Faculty projects stay unpaid like everything else: is_paid still carries
-- its `check (is_paid = false)`. That isn't an oversight — unpaid by
-- construction is what keeps these safe for international students, and it's
-- the reason course-integrated work can be structured the way it is.
