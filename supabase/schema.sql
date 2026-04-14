-- ============================================================
--  WORKMARK DATABASE SCHEMA
--  Paste this entire file into Supabase → SQL Editor → Run
-- ============================================================

-- Enable the pgcrypto extension (for gen_random_uuid, already on by default)
create extension if not exists pgcrypto;

-- ─── Tables ────────────────────────────────────────────────────────────────────

create table if not exists students (
  id               uuid references auth.users on delete cascade primary key,
  full_name        text,
  university       text,
  major            text,
  degree_type      text,                   -- BS, MS, PhD, BA, Other
  graduation_year  int,
  gpa              decimal(3,2),
  is_international boolean default false,
  visa_type        text,                   -- F-1, J-1, OPT, CPT, H-1B, Other
  skills           text[],
  github_url       text,
  linkedin_url     text,
  resume_url       text,                   -- storage path (not public URL)
  availability     text,                   -- 'full-time' | 'part-time'
  hours_per_week   int,
  available_from   date,
  created_at       timestamptz default now()
);

create table if not exists companies (
  id              uuid references auth.users on delete cascade primary key,
  company_name    text,
  website         text,
  industry        text,
  company_size    text,                    -- '1-10' | '11-50' | '51-200' | '200+'
  hq_location     text,
  contact_name    text,
  contact_email   text,
  created_at      timestamptz default now()
);

create table if not exists projects (
  id                  uuid default gen_random_uuid() primary key,
  company_id          uuid references companies(id) on delete cascade,
  title               text,
  description         text,
  type                text,               -- 'project' | 'internship' | 'part-time'
  required_skills     text[],
  preferred_skills    text[],
  work_mode           text,               -- 'remote' | 'onsite' | 'hybrid'
  location            text,
  duration            text,               -- e.g. '8 weeks', '1 semester'
  hours_per_week      int,
  is_paid             boolean default true,
  compensation        text,               -- e.g. '$20/hr', 'Unpaid', 'Stipend'
  work_auth_required  boolean default false,
  min_gpa             decimal(3,2),
  degree_level        text,               -- 'undergrad' | 'grad' | 'both'
  preferred_majors    text[],
  is_open             boolean default true,
  created_at          timestamptz default now()
);

create table if not exists applications (
  id          uuid default gen_random_uuid() primary key,
  project_id  uuid references projects(id) on delete cascade,
  student_id  uuid references students(id) on delete cascade,
  resume_url  text,                        -- storage path
  status      text default 'applied',      -- 'applied' | 'accepted' | 'rejected'
  created_at  timestamptz default now(),
  -- Prevent duplicate applications
  unique (project_id, student_id)
);

create table if not exists experience_records (
  id                   uuid default gen_random_uuid() primary key,
  application_id       uuid references applications(id) on delete cascade,
  student_id           uuid references students(id) on delete cascade,
  company_id           uuid references companies(id) on delete cascade,
  project_id           uuid references projects(id) on delete cascade,
  project_title        text,
  company_name         text,
  skills_used          text[],
  start_date           date,
  end_date             date,
  verification_status  text default 'in_progress', -- 'in_progress' | 'verified' | 'incomplete'
  verification_token   uuid default gen_random_uuid() unique,
  verified_at          timestamptz,
  created_at           timestamptz default now()
);

-- ─── Indexes ───────────────────────────────────────────────────────────────────

create index if not exists idx_projects_company_id    on projects(company_id);
create index if not exists idx_projects_is_open       on projects(is_open);
create index if not exists idx_applications_project   on applications(project_id);
create index if not exists idx_applications_student   on applications(student_id);
create index if not exists idx_exp_student_id         on experience_records(student_id);
create index if not exists idx_exp_company_id         on experience_records(company_id);
create index if not exists idx_exp_token              on experience_records(verification_token);
create index if not exists idx_exp_end_date_status    on experience_records(end_date, verification_status);

-- ─── Row Level Security ────────────────────────────────────────────────────────

alter table students          enable row level security;
alter table companies         enable row level security;
alter table projects          enable row level security;
alter table applications      enable row level security;
alter table experience_records enable row level security;

-- ── students ──

create policy "Students: select own row"
  on students for select
  using (auth.uid() = id);

create policy "Students: insert own row"
  on students for insert
  with check (auth.uid() = id);

create policy "Students: update own row"
  on students for update
  using (auth.uid() = id);

-- Companies need to read basic student info for applications they own.
-- We use a narrow SELECT so they only see what's necessary.
create policy "Companies: read student info via their applications"
  on students for select
  using (
    exists (
      select 1
      from applications a
      join projects p on p.id = a.project_id
      where a.student_id = students.id
        and p.company_id = auth.uid()
    )
  );

-- ── companies ──

create policy "Companies: select own row"
  on companies for select
  using (auth.uid() = id);

create policy "Companies: insert own row"
  on companies for insert
  with check (auth.uid() = id);

create policy "Companies: update own row"
  on companies for update
  using (auth.uid() = id);

-- Students need company name for project detail pages
create policy "Students: read company info for open projects"
  on companies for select
  using (
    exists (
      select 1 from projects p
      where p.company_id = companies.id
        and p.is_open = true
    )
  );

-- ── projects ──

create policy "Anyone: read open projects"
  on projects for select
  using (is_open = true);

create policy "Companies: read all own projects (including closed)"
  on projects for select
  using (auth.uid() = company_id);

create policy "Companies: insert own projects"
  on projects for insert
  with check (auth.uid() = company_id);

create policy "Companies: update own projects"
  on projects for update
  using (auth.uid() = company_id);

create policy "Companies: delete own projects"
  on projects for delete
  using (auth.uid() = company_id);

-- ── applications ──

create policy "Students: read own applications"
  on applications for select
  using (auth.uid() = student_id);

create policy "Students: insert own applications"
  on applications for insert
  with check (auth.uid() = student_id);

-- Students cannot update or delete applications after submission (immutable from student side)

create policy "Companies: read applications for their projects"
  on applications for select
  using (
    exists (
      select 1 from projects p
      where p.id = applications.project_id
        and p.company_id = auth.uid()
    )
  );

create policy "Companies: update application status for their projects"
  on applications for update
  using (
    exists (
      select 1 from projects p
      where p.id = applications.project_id
        and p.company_id = auth.uid()
    )
  );

-- ── experience_records ──

create policy "Students: read own experience records"
  on experience_records for select
  using (auth.uid() = student_id);

create policy "Companies: read experience records for their projects"
  on experience_records for select
  using (auth.uid() = company_id);

create policy "Companies: insert experience records for their projects"
  on experience_records for insert
  with check (auth.uid() = company_id);

create policy "Companies: update experience records for their projects"
  on experience_records for update
  using (auth.uid() = company_id);

-- ─── Storage bucket ────────────────────────────────────────────────────────────
-- Run this separately in the Supabase Storage UI or SQL editor.

insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

-- Storage RLS: students can upload to their own prefix; companies can read all
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

create policy "Companies: read any resume in bucket"
  on storage.objects for select
  using (
    bucket_id = 'resumes'
    and exists (
      select 1 from companies c where c.id = auth.uid()
    )
  );

-- ─── pg_cron job for daily verification email trigger ──────────────────────────
-- This requires the pg_cron extension (available on Supabase Pro).
-- It calls the Edge Function endpoint once per day at 09:00 UTC.
-- Adjust the URL to match your actual Supabase project reference.

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
