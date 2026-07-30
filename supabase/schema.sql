-- ============================================================
--  WORKMARK DATABASE SCHEMA — v2 (MVP + spec §11.1 staging)
--  Paste this entire file into Supabase → SQL Editor → Run.
--
--  DESTRUCTIVE: this file drops every Workmark table and rebuilds
--  from scratch. Safe to re-run on a dev DB. Once real user data
--  exists, prefer supabase/migrations/*.sql for incremental changes.
--
--  Auth users (auth.users) are NOT dropped — those are managed by
--  Supabase Auth. But profile rows in students/companies/faculty
--  get dropped, so any previously-signed-up users will need to
--  re-onboard after this runs.
-- ============================================================

create extension if not exists pgcrypto;

-- ─── Destructive teardown ─────────────────────────────────────────────────────
-- Drop standalone functions. The trigger on verified_work_records doesn't need
-- an explicit drop — CASCADE on the table drop below cleans it up automatically
-- (and DROP TRIGGER ... ON <table> would fail if the table itself doesn't
-- exist yet, which is the state after a partial migration).

drop function if exists trigger_recompute_employer_profile() cascade;
drop function if exists recompute_employer_profile(uuid, text) cascade;

-- Drop tables in reverse-dependency order. CASCADE cleans up FKs / triggers /
-- policies that live on the dropped tables.

drop table if exists issue_flags               cascade;
drop table if exists milestones                cascade;
drop table if exists verified_work_records     cascade;
drop table if exists experience_records        cascade;  -- legacy v1
drop table if exists github_evidenced_skills   cascade;
drop table if exists github_repo_profiles      cascade;
drop table if exists github_connections        cascade;
drop table if exists employer_profiles         cascade;
drop table if exists contact_shares            cascade;
drop table if exists peer_records              cascade;
drop table if exists application_messages      cascade;
drop table if exists applications              cascade;
drop table if exists projects                  cascade;
drop table if exists faculty                   cascade;
drop table if exists companies                 cascade;
drop table if exists students                  cascade;

-- Storage policies live on storage.objects (system table); dropping our
-- tables doesn't cascade to them, so wipe them explicitly.

drop policy if exists "Students: upload own resume"          on storage.objects;
drop policy if exists "Students: read own resume"            on storage.objects;
drop policy if exists "Students: update own resume"          on storage.objects;
drop policy if exists "Companies: read any resume in bucket" on storage.objects;
drop policy if exists "Posters: read any resume in bucket"   on storage.objects;

-- ─── Profile tables ───────────────────────────────────────────────────────────

create table if not exists students (
  id               uuid references auth.users on delete cascade primary key,
  full_name        text,
  university       text,
  major            text,
  degree_type      text,
  graduation_year  int,
  gpa              decimal(3,2),
  is_international boolean default false,
  visa_type        text,
  skills           text[],
  github_url       text,
  github_username  text,
  linkedin_url     text,
  resume_url       text,
  availability     text,
  hours_per_week   int,
  available_from   date,
  open_to_collab   boolean default false not null,  -- opt-in: show in the student directory
  created_at       timestamptz default now()
);

create table if not exists companies (
  id              uuid references auth.users on delete cascade primary key,
  company_name    text,
  website         text,
  industry        text,
  company_size    text,
  hq_location     text,
  contact_name    text,
  contact_email   text,
  created_at      timestamptz default now()
);

create table if not exists faculty (
  id           uuid references auth.users on delete cascade primary key,
  full_name    text,
  institution  text,
  department   text,
  title        text,
  email        text,
  is_approved  boolean default true,
  created_at   timestamptz default now()
);

-- ─── Projects (polymorphic poster: company, faculty, or student) ──────────────

create table if not exists projects (
  id                     uuid default gen_random_uuid() primary key,
  poster_id              uuid not null,
  poster_type            text not null check (poster_type in ('company','faculty','student')),
  poster_display_name    text,
  title                  text,
  description            text,
  type                   text,
  required_skills        text[],
  preferred_skills       text[],
  work_mode              text,
  location               text,
  duration               text,
  hours_per_week         int,
  is_paid                boolean default true,
  compensation           text,
  work_auth_required     boolean default false,
  min_gpa                decimal(3,2),
  degree_level           text,
  preferred_majors       text[],
  scoped_to_institution  text,
  complexity_level       text check (complexity_level in ('beginner','intermediate','advanced')),
  status                 text default 'open' not null check (status in ('open','in_progress','filled','closed')),
  team_size              int default 1,
  view_count             int default 0 not null,
  repo_url               text,
  demo_url               text,
  start_date             date,
  renewed_at             timestamptz,
  is_open                boolean default true,
  created_at             timestamptz default now()
);

-- ─── Applications ─────────────────────────────────────────────────────────────

create table if not exists applications (
  id             uuid default gen_random_uuid() primary key,
  project_id     uuid references projects(id) on delete cascade,
  student_id     uuid references students(id) on delete cascade,
  resume_url     text,
  proposal_text  text,
  status         text default 'applied',  -- 'applied' | 'accepted' | 'rejected' | 'withdrawn'
  created_at     timestamptz default now(),
  unique (project_id, student_id)
);

-- ─── Application messages ───────────────────────────────────────────────────────
--  A small conversation thread on a pending application, so either side can
--  ask a clarifying question before committing to accept/decline.

create table if not exists application_messages (
  id             uuid default gen_random_uuid() primary key,
  application_id uuid references applications(id) on delete cascade not null,
  sender_id      uuid not null,
  body           text not null,
  created_at     timestamptz default now()
);

-- ─── Contact shares ─────────────────────────────────────────────────────────────
--  Peer-to-peer (student-posted) collaboration requests don't flow into the
--  verified_work_records attestation pipeline — accepting one just exchanges
--  contact info between the two students. Populated by the service-role
--  client in /api/collab/accept (real emails come from auth.users, which
--  isn't queryable under RLS), never inserted by authenticated users directly.

create table if not exists contact_shares (
  id             uuid default gen_random_uuid() primary key,
  application_id uuid references applications(id) on delete cascade not null unique,
  student_id     uuid references students(id) on delete cascade not null,
  poster_id      uuid not null,
  student_email  text,
  poster_email   text,
  shared_at      timestamptz default now()
);

-- ─── Peer records ───────────────────────────────────────────────────────────────
--  A much lighter version of verified_work_records for peer-to-peer
--  collaborations: no 6-question co-write, no tiers, just "did this happen"
--  confirmed by both sides. Created by /api/collab/accept the moment a
--  request is accepted; locked once both confirm via
--  /api/collab/confirm-completion.

create table if not exists peer_records (
  id                    uuid default gen_random_uuid() primary key,
  application_id        uuid references applications(id) on delete cascade not null unique,
  project_id            uuid references projects(id) on delete cascade not null,
  poster_id             uuid not null,
  student_id            uuid references students(id) on delete cascade not null,
  project_title         text,
  skills_used           text[],
  summary               text,
  poster_confirmed_at   timestamptz,
  student_confirmed_at  timestamptz,
  locked_at             timestamptz,
  created_at            timestamptz default now()
);

-- ─── Verified work records (supersedes experience_records) ────────────────────
--  Layer 1 structural facts, Layer 2 co-written summary + 6-Q attestation,
--  tier (1 employer / 2 faculty / 3 github-evidenced — records here are 1 or 2),
--  mutual approval, immutable lock.

create table if not exists verified_work_records (
  id                            uuid default gen_random_uuid() primary key,
  application_id                uuid references applications(id) on delete cascade,
  student_id                    uuid references students(id) on delete cascade,
  poster_id                     uuid not null,
  poster_type                   text not null check (poster_type in ('company','faculty')),
  project_id                    uuid references projects(id) on delete cascade,

  -- Layer 1 structural facts
  project_title                 text,
  poster_display_name           text,
  skills_used                   text[],
  start_date                    date,
  end_date                      date,
  hours_logged                  int,
  outcome                       text,  -- 'completed' | 'partial' | 'terminated' | null while in progress

  -- Layer 2 co-written summary + attestation
  summary_draft                 text,
  summary_final                 text,
  technologies_used             text[],
  deliverables_status           text,  -- 'yes' | 'partial' | 'no'
  would_engage_again            boolean,
  independence_level            text,  -- 'independent' | 'some_guidance' | 'frequent_checkins'
  communication_level           text,  -- 'proactive' | 'responsive' | 'needed_followup'
  problem_solving_level         text,  -- 'proposed_solutions' | 'described_problems' | 'got_stuck'

  -- Tier + mutual lock
  tier                          int check (tier in (1,2)),
  student_approved_at           timestamptz,
  poster_approved_at            timestamptz,
  locked_at                     timestamptz,

  -- Layer 3 (optional artifacts, employer-approved)
  artifact_urls                 text[],

  -- Complexity (deterministic, hidden — informs sort order in future)
  complexity_score              int,

  -- Verification email flow
  verification_status           text default 'in_progress',  -- 'in_progress' | 'verified' | 'incomplete'
  verification_token            uuid default gen_random_uuid() unique,
  verified_at                   timestamptz,

  created_at                    timestamptz default now()
);

-- ─── Milestones (safety-net check-ins) ────────────────────────────────────────

create table if not exists milestones (
  id           uuid default gen_random_uuid() primary key,
  record_id    uuid references verified_work_records(id) on delete cascade,
  title        text,
  due_date     date,
  status       text default 'upcoming',  -- 'upcoming' | 'on_track' | 'issue_flagged' | 'completed'
  notes        text,
  created_at   timestamptz default now()
);

-- ─── Issue flags (either party can flag privately) ────────────────────────────

create table if not exists issue_flags (
  id                uuid default gen_random_uuid() primary key,
  record_id         uuid references verified_work_records(id) on delete cascade,
  flagged_by_role   text check (flagged_by_role in ('student','poster')),
  description       text,
  resolved_at       timestamptz,
  created_at        timestamptz default now()
);

-- ─── GitHub-evidenced skills (Tier 3 populated by dependency parser) ──────────

create table if not exists github_evidenced_skills (
  id              uuid default gen_random_uuid() primary key,
  student_id      uuid references students(id) on delete cascade,
  skill           text,
  evidence_count  int default 1,
  repo_urls       text[],
  extracted_at    timestamptz default now(),
  unique (student_id, skill)
);

-- Per-student GitHub OAuth token, stored so the scanner can call the GitHub
-- API on the student's behalf. Uses our own OAuth flow (see /api/github/*)
-- rather than Supabase's manual identity linking, which is a beta feature
-- that isn't reliably togglable.
--
-- Security note: access_token is stored plaintext for MVP. Scope is limited
-- to 'read:user public_repo' — blast radius is bounded. Add pgsodium at-rest
-- encryption before handling any student's private data or paid engagements.
create table if not exists github_connections (
  student_id     uuid references students(id) on delete cascade primary key,
  github_login   text,
  access_token   text not null,
  scope          text,
  connected_at   timestamptz default now()
);

-- Per-repo structural profile (spec §5.1.1): project type, architecture
-- pattern, maturity indicators. Populated by the same scan endpoint.
create table if not exists github_repo_profiles (
  id                uuid default gen_random_uuid() primary key,
  student_id        uuid references students(id) on delete cascade,
  repo_full_name    text,       -- e.g. "octocat/hello-world"
  repo_url          text,
  project_type      text,       -- 'web-app' | 'api' | 'ml' | 'cli' | 'library' | 'mobile' | 'unknown'
  architecture      text,       -- 'monolith' | 'microservices' | 'serverless' | 'static' | 'unknown'
  has_tests         boolean default false,
  has_ci            boolean default false,
  has_docker        boolean default false,
  has_docs          boolean default false,
  has_auth          boolean default false,
  has_deploy_config boolean default false,
  extracted_at      timestamptz default now(),
  unique (student_id, repo_full_name)
);

-- ─── Employer profile aggregates (spec §8) ────────────────────────────────────

create table if not exists employer_profiles (
  poster_id                     uuid primary key,
  poster_type                   text not null check (poster_type in ('company','faculty')),
  engagements_completed         int default 0,
  attestation_completion_rate   decimal(4,3),
  average_complexity            decimal(4,2),
  repeat_engagement_rate        decimal(4,3),
  updated_at                    timestamptz default now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

create index if not exists idx_projects_poster        on projects(poster_id, poster_type);
create index if not exists idx_projects_is_open       on projects(is_open);
create index if not exists idx_applications_project   on applications(project_id);
create index if not exists idx_applications_student   on applications(student_id);
create index if not exists idx_application_messages_application on application_messages(application_id);
create index if not exists idx_contact_shares_student  on contact_shares(student_id);
create index if not exists idx_contact_shares_poster   on contact_shares(poster_id);
create index if not exists idx_peer_records_student   on peer_records(student_id);
create index if not exists idx_peer_records_poster    on peer_records(poster_id);
create index if not exists idx_vwr_student            on verified_work_records(student_id);
create index if not exists idx_vwr_poster             on verified_work_records(poster_id, poster_type);
create index if not exists idx_vwr_token              on verified_work_records(verification_token);
create index if not exists idx_vwr_end_status         on verified_work_records(end_date, verification_status);
create index if not exists idx_milestones_record      on milestones(record_id);
create index if not exists idx_issue_flags_record     on issue_flags(record_id);
create index if not exists idx_ges_student            on github_evidenced_skills(student_id);
create index if not exists idx_grp_student            on github_repo_profiles(student_id);
create index if not exists idx_ghc_login              on github_connections(github_login);

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table students                enable row level security;
alter table companies               enable row level security;
alter table faculty                 enable row level security;
alter table projects                enable row level security;
alter table applications            enable row level security;
alter table application_messages    enable row level security;
alter table contact_shares          enable row level security;
alter table peer_records            enable row level security;
alter table verified_work_records   enable row level security;
alter table milestones              enable row level security;
alter table issue_flags             enable row level security;
alter table github_evidenced_skills enable row level security;
alter table github_repo_profiles    enable row level security;
alter table github_connections      enable row level security;
alter table employer_profiles       enable row level security;

-- ── students ──

create policy "Students: select own row"
  on students for select using (auth.uid() = id);

create policy "Students: insert own row"
  on students for insert with check (auth.uid() = id);

create policy "Students: update own row"
  on students for update using (auth.uid() = id);

create policy "Posters: read student info via their applications"
  on students for select
  using (
    exists (
      select 1
      from applications a
      join projects p on p.id = a.project_id
      where a.student_id = students.id
        and p.poster_id = auth.uid()
    )
  );

-- Mirrors "Anyone: read company/faculty info for open projects" below —
-- a student who posts an open project is publicly visible the same way a
-- posting company or faculty member is.
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

-- Opt-in student directory — only visible to other signed-in students, and
-- only for students who've explicitly turned it on (default off).
create policy "Anyone signed in: read opted-in student directory"
  on students for select
  using (open_to_collab = true and auth.uid() is not null);

-- ── companies ──

create policy "Companies: select own row"
  on companies for select using (auth.uid() = id);

create policy "Companies: insert own row"
  on companies for insert with check (auth.uid() = id);

create policy "Companies: update own row"
  on companies for update using (auth.uid() = id);

create policy "Anyone: read company info for open projects"
  on companies for select
  using (
    exists (
      select 1 from projects p
      where p.poster_id = companies.id
        and p.poster_type = 'company'
        and p.is_open = true
    )
  );

-- ── faculty ──

create policy "Faculty: select own row"
  on faculty for select using (auth.uid() = id);

create policy "Faculty: insert own row"
  on faculty for insert with check (auth.uid() = id);

create policy "Faculty: update own row"
  on faculty for update using (auth.uid() = id);

create policy "Anyone: read faculty info for open projects"
  on faculty for select
  using (
    exists (
      select 1 from projects p
      where p.poster_id = faculty.id
        and p.poster_type = 'faculty'
        and p.is_open = true
    )
  );

-- ── projects ──

create policy "Anyone: read open projects"
  on projects for select using (is_open = true);

create policy "Posters: read all own projects"
  on projects for select using (auth.uid() = poster_id);

create policy "Posters: insert own projects"
  on projects for insert with check (auth.uid() = poster_id);

create policy "Posters: update own projects"
  on projects for update using (auth.uid() = poster_id);

create policy "Posters: delete own projects"
  on projects for delete using (auth.uid() = poster_id);

-- ── applications ──

create policy "Students: read own applications"
  on applications for select using (auth.uid() = student_id);

create policy "Students: insert own applications"
  on applications for insert with check (auth.uid() = student_id);

create policy "Posters: read applications for their projects"
  on applications for select
  using (
    exists (
      select 1 from projects p
      where p.id = applications.project_id
        and p.poster_id = auth.uid()
    )
  );

create policy "Posters: update application status for their projects"
  on applications for update
  using (
    exists (
      select 1 from projects p
      where p.id = applications.project_id
        and p.poster_id = auth.uid()
    )
  );

-- A student can withdraw their own still-pending request. USING restricts
-- which rows are eligible (must be theirs, must currently be "applied");
-- WITH CHECK restricts what the row is allowed to become (must land on
-- "withdrawn") — together they only permit this one transition.
create policy "Students: withdraw own pending application"
  on applications for update
  using (auth.uid() = student_id and status = 'applied')
  with check (auth.uid() = student_id and status = 'withdrawn');

-- ── application_messages ──
-- A small conversation thread on a pending application — either participant
-- (the applicant, or the project's poster) can read and post to it.

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

-- ── contact_shares ──
-- Insert-only via the service-role client (bypasses RLS) — no insert policy
-- needed for authenticated users.

create policy "Contact shares: participants read"
  on contact_shares for select
  using (auth.uid() = student_id or auth.uid() = poster_id);

-- ── peer_records ──
-- Inserted via the service-role client in /api/collab/accept (same
-- centralized-write reasoning as contact_shares). Confirming completion runs
-- under the caller's own session, so it needs a real update policy.

create policy "Peer records: participants read"
  on peer_records for select
  using (auth.uid() = student_id or auth.uid() = poster_id);

create policy "Peer records: participants confirm completion"
  on peer_records for update
  using (auth.uid() = student_id or auth.uid() = poster_id);

-- ── verified_work_records ──

create policy "Students: read own records"
  on verified_work_records for select using (auth.uid() = student_id);

create policy "Posters: read own records"
  on verified_work_records for select using (auth.uid() = poster_id);

create policy "Posters: insert own records"
  on verified_work_records for insert with check (auth.uid() = poster_id);

create policy "Posters: update own records"
  on verified_work_records for update using (auth.uid() = poster_id);

create policy "Students: update own records for co-write"
  on verified_work_records for update using (auth.uid() = student_id);

-- ── milestones ──

create policy "Milestone participants: read"
  on milestones for select
  using (
    exists (
      select 1 from verified_work_records r
      where r.id = milestones.record_id
        and (r.student_id = auth.uid() or r.poster_id = auth.uid())
    )
  );

create policy "Milestone participants: write"
  on milestones for insert
  with check (
    exists (
      select 1 from verified_work_records r
      where r.id = milestones.record_id
        and (r.student_id = auth.uid() or r.poster_id = auth.uid())
    )
  );

create policy "Milestone participants: update"
  on milestones for update
  using (
    exists (
      select 1 from verified_work_records r
      where r.id = milestones.record_id
        and (r.student_id = auth.uid() or r.poster_id = auth.uid())
    )
  );

-- ── issue_flags ──

create policy "Flag participants: read"
  on issue_flags for select
  using (
    exists (
      select 1 from verified_work_records r
      where r.id = issue_flags.record_id
        and (r.student_id = auth.uid() or r.poster_id = auth.uid())
    )
  );

create policy "Flag participants: insert"
  on issue_flags for insert
  with check (
    exists (
      select 1 from verified_work_records r
      where r.id = issue_flags.record_id
        and (r.student_id = auth.uid() or r.poster_id = auth.uid())
    )
  );

-- ── github_evidenced_skills ──

create policy "Students: read own github skills"
  on github_evidenced_skills for select using (auth.uid() = student_id);

create policy "Students: write own github skills"
  on github_evidenced_skills for insert with check (auth.uid() = student_id);

create policy "Students: update own github skills"
  on github_evidenced_skills for update using (auth.uid() = student_id);

create policy "Students: delete own github skills"
  on github_evidenced_skills for delete using (auth.uid() = student_id);

create policy "Posters via applications: read github skills"
  on github_evidenced_skills for select
  using (
    exists (
      select 1
      from applications a
      join projects p on p.id = a.project_id
      where a.student_id = github_evidenced_skills.student_id
        and p.poster_id = auth.uid()
    )
  );

-- ── github_repo_profiles ──

create policy "Students: read own repo profiles"
  on github_repo_profiles for select using (auth.uid() = student_id);

create policy "Students: write own repo profiles"
  on github_repo_profiles for insert with check (auth.uid() = student_id);

create policy "Students: update own repo profiles"
  on github_repo_profiles for update using (auth.uid() = student_id);

create policy "Students: delete own repo profiles"
  on github_repo_profiles for delete using (auth.uid() = student_id);

create policy "Posters via applications: read repo profiles"
  on github_repo_profiles for select
  using (
    exists (
      select 1
      from applications a
      join projects p on p.id = a.project_id
      where a.student_id = github_repo_profiles.student_id
        and p.poster_id = auth.uid()
    )
  );

-- ── github_connections ──
-- Writes are done from the OAuth callback route using service_role, so no
-- INSERT/UPDATE policies are needed for anon users. Students can only read
-- their own token (and can delete it to disconnect).

create policy "Students: read own github connection"
  on github_connections for select using (auth.uid() = student_id);

create policy "Students: delete own github connection"
  on github_connections for delete using (auth.uid() = student_id);

-- ── employer_profiles ──

create policy "Anyone: read employer profiles"
  on employer_profiles for select using (true);

-- ─── Storage bucket ───────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

create policy "Students: upload own resume"
  on storage.objects for insert
  with check (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Students: read own resume"
  on storage.objects for select
  using (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Students: update own resume"
  on storage.objects for update
  using (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Companies, faculty, and students can all post projects and act as posters.
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

-- ─── Employer profile aggregator ──────────────────────────────────────────────
--  Recomputes an employer's aggregate stats whenever a record is locked or
--  when attestation is completed. Cheap because we only look at that poster's
--  records; a full recompute is fine at MVP scale.

create or replace function recompute_employer_profile(p_id uuid, p_type text)
returns void language plpgsql as $$
declare
  v_engagements int;
  v_locked int;
  v_avg_complexity decimal(4,2);
  v_repeat_rate decimal(4,3);
  v_would_engage int;
begin
  select
    count(*) filter (where locked_at is not null),
    count(*) filter (where locked_at is not null),
    avg(complexity_score) filter (where locked_at is not null and complexity_score is not null),
    count(*) filter (where locked_at is not null and would_engage_again is true)
  into v_locked, v_engagements, v_avg_complexity, v_would_engage
  from verified_work_records
  where poster_id = p_id and poster_type = p_type;

  insert into employer_profiles (
    poster_id, poster_type, engagements_completed,
    attestation_completion_rate, average_complexity,
    repeat_engagement_rate, updated_at
  ) values (
    p_id, p_type, coalesce(v_locked, 0),
    -- Attestation completion rate: locked / (locked + still-in-progress-past-end-date). Simplified for MVP:
    case when v_engagements > 0 then 1.0 else null end,
    v_avg_complexity,
    case when v_locked > 0 then v_would_engage::decimal / v_locked else null end,
    now()
  )
  on conflict (poster_id) do update set
    engagements_completed        = excluded.engagements_completed,
    attestation_completion_rate  = excluded.attestation_completion_rate,
    average_complexity           = excluded.average_complexity,
    repeat_engagement_rate       = excluded.repeat_engagement_rate,
    updated_at                   = excluded.updated_at,
    poster_type                  = excluded.poster_type;
end $$;

create or replace function trigger_recompute_employer_profile()
returns trigger language plpgsql as $$
begin
  perform recompute_employer_profile(new.poster_id, new.poster_type);
  return new;
end $$;

drop trigger if exists verified_work_records_recompute on verified_work_records;
create trigger verified_work_records_recompute
  after insert or update of locked_at, complexity_score, would_engage_again
  on verified_work_records
  for each row
  execute function trigger_recompute_employer_profile();

-- ─── pg_cron job for daily verification email trigger ─────────────────────────

-- select cron.schedule(
--   'workmark-daily-verification',
--   '0 9 * * *',
--   $$
--     select
--       net.http_post(
--         url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/send-verification-emails',
--         headers := jsonb_build_object(
--           'Content-Type', 'application/json',
--           'Authorization', 'Bearer <YOUR_ANON_KEY>'
--         ),
--         body := '{}'::jsonb
--       )
--   $$
-- );
