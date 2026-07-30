-- ============================================================
--  WORKMARK MIGRATION 0003 — Marketplace v2
--  Paste into Supabase → SQL Editor → Run.
--
--  Adds the features from the "make the student marketplace feel like a
--  real product" brainstorm, minus notifications:
--   - peer completion attestation (peer_records)
--   - pre-accept conversation (application_messages)
--   - withdraw a pending request
--   - project status / team size / view count / repo+demo links / start date
--   - opt-in student directory
--   - stale-listing renewal (renewed_at)
-- ============================================================

-- ─── students: opt-in directory visibility ─────────────────────────────────────
alter table students
  add column if not exists open_to_collab boolean default false not null;

-- ─── projects: richer posting + lifecycle metadata ─────────────────────────────
-- (status is a brand-new column, so unlike the poster_type widen in 0002 there's
-- no pre-existing constraint to introspect — just add it with the check inline.)
alter table projects
  add column if not exists status text default 'open' not null,
  add column if not exists team_size int default 1,
  add column if not exists view_count int default 0 not null,
  add column if not exists repo_url text,
  add column if not exists demo_url text,
  add column if not exists start_date date,
  add column if not exists renewed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'projects'::regclass and conname = 'projects_status_check'
  ) then
    alter table projects
      add constraint projects_status_check
      check (status in ('open', 'in_progress', 'filled', 'closed'));
  end if;
end $$;

-- ─── peer_records: lightweight mutual completion attestation ──────────────────
-- Deliberately separate from verified_work_records (which stays scoped to
-- employer/faculty attestation with its 6-question co-write + tier system).
-- Peer collaborations get a much lighter version: both sides just confirm the
-- work happened and optionally leave a one-line summary of what got built.
-- Created by /api/collab/accept the moment a request is accepted; locked once
-- both sides confirm via /api/collab/confirm-completion.
create table if not exists peer_records (
  id                    uuid default gen_random_uuid() primary key,
  application_id        uuid references applications(id) on delete cascade not null unique,
  project_id             uuid references projects(id) on delete cascade not null,
  poster_id              uuid not null,
  student_id             uuid references students(id) on delete cascade not null,
  project_title          text,
  skills_used            text[],
  summary                text,
  poster_confirmed_at    timestamptz,
  student_confirmed_at   timestamptz,
  locked_at              timestamptz,
  created_at             timestamptz default now()
);

create index if not exists idx_peer_records_student on peer_records(student_id);
create index if not exists idx_peer_records_poster  on peer_records(poster_id);

alter table peer_records enable row level security;

drop policy if exists "Peer records: participants read" on peer_records;
create policy "Peer records: participants read"
  on peer_records for select
  using (auth.uid() = student_id or auth.uid() = poster_id);

-- Inserts happen via the service-role client in /api/collab/accept (same
-- reasoning as contact_shares — keeps the write path centralized in one
-- reviewed API route rather than trusting the client to only insert once
-- per accepted application). Updates (confirming completion) go through
-- /api/collab/confirm-completion using the caller's own session.
drop policy if exists "Peer records: participants confirm completion" on peer_records;
create policy "Peer records: participants confirm completion"
  on peer_records for update
  using (auth.uid() = student_id or auth.uid() = poster_id);

-- ─── application_messages: conversation before accept/decline ─────────────────
create table if not exists application_messages (
  id             uuid default gen_random_uuid() primary key,
  application_id uuid references applications(id) on delete cascade not null,
  sender_id      uuid not null,
  body           text not null,
  created_at     timestamptz default now()
);

create index if not exists idx_application_messages_application on application_messages(application_id);

alter table application_messages enable row level security;

drop policy if exists "Application participants: read messages" on application_messages;
create policy "Application participants: read messages"
  on application_messages for select
  using (
    exists (
      select 1 from applications a
      join projects p on p.id = a.project_id
      where a.id = application_messages.application_id
        and (a.student_id = auth.uid() or p.poster_id = auth.uid())
    )
  );

drop policy if exists "Application participants: send messages" on application_messages;
create policy "Application participants: send messages"
  on application_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from applications a
      join projects p on p.id = a.project_id
      where a.id = application_messages.application_id
        and (a.student_id = auth.uid() or p.poster_id = auth.uid())
    )
  );

-- ─── applications: let a student withdraw their own pending request ──────────
drop policy if exists "Students: withdraw own pending application" on applications;
create policy "Students: withdraw own pending application"
  on applications for update
  using (auth.uid() = student_id and status = 'applied')
  with check (auth.uid() = student_id and status = 'withdrawn');

-- ─── students: opted-in directory, visible to any signed-in student ──────────
drop policy if exists "Anyone signed in: read opted-in student directory" on students;
create policy "Anyone signed in: read opted-in student directory"
  on students for select
  using (open_to_collab = true and auth.uid() is not null);
