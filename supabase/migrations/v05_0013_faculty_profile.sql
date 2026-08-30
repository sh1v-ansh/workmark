-- Somewhere for a faculty member's name to live.
--
-- Onboarding wrote a `students` row for everyone, faculty included. That was
-- the only place a name could go, so a professor got a student record: a
-- graduation year they don't have, a GPA, a slot in the student directory,
-- and a row in the table the scanner and the matcher both read. The role
-- said "faculty" and every table said "student".
--
-- The account row is the right home for it. It is the one row that exists
-- for every login regardless of what kind of person they are, which is
-- exactly the shape a display name has.

alter table accounts
  add column if not exists display_name text,
  add column if not exists institution  text;

-- Backfill from the student profiles that were carrying this until now, so
-- existing accounts keep their name in the navbar and the admin console.
update accounts a
   set display_name = coalesce(a.display_name, s.full_name),
       institution  = coalesce(a.institution,  s.university)
  from students s
 where s.id = a.id
   and (a.display_name is null or a.institution is null);

-- Faculty accounts created before this migration still have a students row.
-- It is left in place rather than deleted: `open_to_collab` defaults to
-- false so it never surfaced in the directory, and dropping a row that other
-- tables may reference is not worth doing automatically. To clear them out
-- once you have confirmed none are real students, run:
--
--   delete from students s
--    using accounts a
--    where a.id = s.id
--      and 'faculty' = any(a.roles)
--      and not ('student' = any(a.roles));
