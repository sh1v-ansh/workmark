-- ============================================================
--  WORKMARK MIGRATION 0002 — Student-to-student marketplace
--  Paste into Supabase → SQL Editor → Run.
--
--  Adds support for students posting projects that other students
--  browse and request to collaborate on. Reuses the existing
--  polymorphic projects/applications tables (poster_id + poster_type)
--  rather than introducing parallel tables — a "student" poster is
--  just a third poster_type alongside 'company' and 'faculty'.
--
--  Peer-to-peer collaborations deliberately do NOT flow into
--  verified_work_records — that table (and its tier/attestation
--  pipeline) stays scoped to employer/faculty-verified experience.
--  Peer collabs get a lighter-weight outcome: accepted requests
--  exchange contact info via the new contact_shares table.
-- ============================================================

-- ─── Widen projects.poster_type to include 'student' ──────────────────────────
-- Drop the existing CHECK constraint by introspecting its real name (don't
-- assume the default Postgres-generated name) then recreate it widened.
do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'projects'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%poster_type%';
  if con_name is not null then
    execute format('alter table projects drop constraint %I', con_name);
  end if;
end $$;

alter table projects
  add constraint projects_poster_type_check
  check (poster_type in ('company', 'faculty', 'student'));

-- ─── Complexity level (poster-set, shown as a tag — distinct from the hidden
--     algorithmic complexity_score on verified_work_records) ──────────────────
alter table projects
  add column if not exists complexity_level text
  check (complexity_level in ('beginner', 'intermediate', 'advanced'));

-- ─── Contact exchange on accepted collaboration requests ───────────────────────
create table if not exists contact_shares (
  id             uuid default gen_random_uuid() primary key,
  application_id uuid references applications(id) on delete cascade not null unique,
  student_id     uuid references students(id) on delete cascade not null,  -- the applicant
  poster_id      uuid not null,                                            -- the project poster
  student_email  text,
  poster_email   text,
  shared_at      timestamptz default now()
);

create index if not exists idx_contact_shares_student on contact_shares(student_id);
create index if not exists idx_contact_shares_poster   on contact_shares(poster_id);

alter table contact_shares enable row level security;

drop policy if exists "Contact shares: participants read" on contact_shares;
create policy "Contact shares: participants read"
  on contact_shares for select
  using (auth.uid() = student_id or auth.uid() = poster_id);

-- Inserts happen only via the service-role client in /api/collab/accept,
-- which bypasses RLS — no insert policy needed for authenticated users.

-- ─── Let anyone browsing see a student poster's basic profile ─────────────────
-- Mirrors "Anyone: read company/faculty info for open projects" — a student
-- who posts an open project is publicly visible the same way a posting
-- company or faculty member already is.
drop policy if exists "Anyone: read student info for open projects" on students;
create policy "Anyone: read student info for open projects"
  on students for select
  using (
    exists (
      select 1 from projects p
      where p.poster_id = students.id
        and p.poster_type = 'student'
        and p.is_open = true
    )
  );

-- ─── Let student-posters read applicant resumes too ────────────────────────────
-- (Existing policy only covered companies/faculty as posters; students can now
-- post projects and need the same "any poster can view an applicant's resume"
-- access companies/faculty already have.)
drop policy if exists "Posters: read any resume in bucket" on storage.objects;
create policy "Posters: read any resume in bucket"
  on storage.objects for select
  using (
    bucket_id = 'resumes'
    and (
      exists (select 1 from companies c where c.id = auth.uid())
      or exists (select 1 from faculty f where f.id = auth.uid())
      or exists (select 1 from students s where s.id = auth.uid())
    )
  );
