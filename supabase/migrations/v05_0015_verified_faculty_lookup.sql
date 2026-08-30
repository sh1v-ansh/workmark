-- "Is this poster confirmed faculty?" — and nothing else.
--
-- Students need this to read a listing honestly: a project posted by a
-- professor we have actually checked is a different proposition from one
-- posted by an account that merely says so, and the whole point of
-- confirming faculty is that the difference reaches the person deciding
-- whether to apply.
--
-- It can't be a plain select. `accounts` is behind RLS that lets you read
-- your own row and nothing else, which is correct — the table holds roles,
-- status, and who confirmed whom. Opening it up so listings can show a badge
-- would trade a large disclosure for a small feature, and RLS grants rows,
-- not columns, so there is no way to open "just this bit" with a policy.
--
-- A security-definer function is the narrow version. It answers one question
-- about ids the caller already has (they came from listings that caller can
-- already see) and returns a single boolean's worth of information per id.
-- Nothing about roles, status, or who did the confirming leaves the database.
--
-- Deliberately returns only the confirmed ones. An unconfirmed faculty claim
-- is not surfaced as "faculty, unverified" — that still tells a student
-- "professor", which is the part nobody has checked. Until it is confirmed,
-- the listing simply carries no claim.

create or replace function verified_faculty_ids(p_ids uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
    from accounts
   where id = any(p_ids)
     and status = 'active'
     and 'faculty' = any(roles)
     and faculty_verified_at is not null;
$$;

revoke all on function verified_faculty_ids(uuid[]) from public;

-- Signed-out visitors browse listings too, and a recruiter or a prospective
-- student seeing the same badge as everyone else is the point of it.
grant execute on function verified_faculty_ids(uuid[]) to anon, authenticated;
