-- Roles, an admin concept, and a trail of what staff did.
--
-- Until now there was exactly one kind of account. Onboarding wrote to
-- `students` and nothing else, and signup required a .edu address — which
-- doesn't separate faculty from students, because professors have
-- university addresses too. A professor signing up today passes the check,
-- gets asked for their graduation year, and silently becomes a student row.
--
-- There was also no admin. The human review queue is a CLI script, and the
-- reviewer is "whoever holds the service key" — which means the same
-- credential that runs migrations is also the one that reads students'
-- files, with no scoping and no record of who looked at what.

-- ─── accounts ────────────────────────────────────────────────────────────────
-- One row per login, holding what kind of person this is. `students` stays
-- exactly as it was and becomes the student-specific profile hanging off
-- this; faculty and poster profiles become siblings later.

create table if not exists accounts (
  id                  uuid primary key references auth.users(id) on delete cascade,
  -- An array rather than a single column on purpose. A PhD student takes
  -- courses, TAs, and runs lab projects — they are genuinely a student and
  -- faculty at once, and a single value forces a wrong answer.
  roles               text[] not null default '{student}',
  status              text not null default 'active' check (status in ('active', 'suspended')),
  -- Faculty is self-declared at signup and verified afterwards. Null here
  -- doesn't block anything: an unverified faculty account works, it just
  -- doesn't carry faculty weight. That way lying about it gains nothing and
  -- nobody waits on us to check.
  faculty_verified_at timestamptz,
  faculty_verified_by uuid references auth.users(id),
  created_at          timestamptz default now() not null,
  updated_at          timestamptz default now() not null
);

alter table accounts drop constraint if exists accounts_roles_valid;
alter table accounts add constraint accounts_roles_valid check (
  roles <@ array['student', 'faculty', 'admin']::text[] and array_length(roles, 1) >= 1
);

create index if not exists accounts_roles_idx on accounts using gin (roles);

-- Backfill. Must happen in the same migration as the table: the first
-- request after deploy reads this for every signed-in user, and an existing
-- student without a row would be treated as having no roles at all.
insert into accounts (id, roles)
select id, array['student']::text[] from students
on conflict (id) do nothing;

-- ─── role checks ─────────────────────────────────────────────────────────────
-- Read from the table rather than from the login token. Putting roles in the
-- token is the faster option and the usual advice, but the token goes stale:
-- revoking someone's admin wouldn't take effect until their session
-- refreshed. Volume here is tiny and admin is the sensitive role, so the
-- lookup is the right trade.

create or replace function has_role(p_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p_role = any(roles) and status = 'active' from accounts where id = auth.uid()),
    false
  );
$$;

revoke all on function has_role(text) from public, anon;
grant execute on function has_role(text) to authenticated;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select has_role('admin');
$$;

revoke all on function is_admin() from public, anon;
grant execute on function is_admin() to authenticated;

alter table accounts enable row level security;

drop policy if exists "Users: read own account" on accounts;
create policy "Users: read own account" on accounts
  for select using (auth.uid() = id);

-- Deliberately no insert or update policy for regular users. An account row
-- says what someone is allowed to be; letting them write it would let anyone
-- grant themselves admin. Created by the onboarding route under the service
-- role, changed only by an admin.
drop policy if exists "Admins: read all accounts" on accounts;
create policy "Admins: read all accounts" on accounts
  for select using (is_admin());

-- ─── admin_actions ───────────────────────────────────────────────────────────
-- Every staff action, and every staff read of someone's record.
--
-- Reads are logged as well as writes, which is unusual and deliberate. An
-- admin opening a student's file is a person reading a consumer record about
-- someone else. Internally that's permitted — but "who looked at this, and
-- when" is the first question anyone asks after a complaint, and it cannot
-- be answered retroactively.

create table if not exists admin_actions (
  id            uuid default gen_random_uuid() primary key,
  admin_id      uuid references auth.users(id) not null,
  action        text not null,
  -- What was acted on: 'review_request', 'dispute', 'account', etc.
  subject_type  text not null,
  subject_id    text not null,
  -- Whose record this concerned, when that's a person. Lets "everything
  -- staff did touching this student" be one query.
  student_id    uuid references students(id) on delete set null,
  detail        jsonb,
  created_at    timestamptz default now() not null
);

create index if not exists admin_actions_subject_idx on admin_actions (subject_type, subject_id);
create index if not exists admin_actions_student_idx on admin_actions (student_id, created_at desc);
create index if not exists admin_actions_admin_idx on admin_actions (admin_id, created_at desc);

alter table admin_actions enable row level security;

drop policy if exists "Admins: read admin actions" on admin_actions;
create policy "Admins: read admin actions" on admin_actions
  for select using (is_admin());

-- No insert policy: written by the server under the service role, so a
-- client can't forge or suppress an entry about itself.

-- ─── unresolved skills ───────────────────────────────────────────────────────
-- Names the matcher couldn't confidently place.
--
-- These were being dropped silently. A skill that doesn't clear the
-- similarity threshold simply vanished, so students lost skills and there
-- was no way to find out which, or how often. The seen count is the useful
-- part: it says which unmatched strings are common enough to be worth adding
-- to the taxonomy.

create table if not exists unresolved_skills (
  id            uuid default gen_random_uuid() primary key,
  raw_string    text not null unique,
  -- What it nearly matched, with scores, so a reviewer can accept one
  -- rather than searching the taxonomy from scratch.
  candidates    jsonb,
  seen_count    int not null default 1,
  last_seen_at  timestamptz default now() not null,
  first_seen_at timestamptz default now() not null,
  -- An example of where it came from, for context when reviewing.
  example_source text,
  status        text not null default 'pending'
                check (status in ('pending', 'mapped', 'not_a_skill')),
  resolved_by   uuid references auth.users(id),
  resolved_at   timestamptz,
  mapped_skill_id text references skills(id)
);

create index if not exists unresolved_skills_pending_idx
  on unresolved_skills (seen_count desc)
  where status = 'pending';

alter table unresolved_skills enable row level security;

drop policy if exists "Admins: read unresolved skills" on unresolved_skills;
create policy "Admins: read unresolved skills" on unresolved_skills
  for select using (is_admin());

-- Increment the seen count for names already on file.
--
-- The caller inserts-ignoring-duplicates first, then calls this. Two steps
-- rather than one bulk upsert because the count has to increment rather than
-- be overwritten — and the count is the whole point: it says whether a
-- missing name is one student's typo or a real gap in the taxonomy.
create or replace function bump_unresolved_skills(p_raw_strings text[])
returns void
language sql
security definer
set search_path = public
as $$
  update unresolved_skills
     set seen_count = seen_count + 1,
         last_seen_at = now()
   where raw_string = any(p_raw_strings)
     and status = 'pending';
$$;

revoke all on function bump_unresolved_skills(text[]) from public, anon, authenticated;
