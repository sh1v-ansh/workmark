-- ============================================================
--  WORKMARK MIGRATION 0004 — Application gating for the peer marketplace
--  Paste into Supabase → SQL Editor → Run.
--
--  Keeps a student poster from facing a wall of applicants:
--   - a hard cap on applications per project ("6 of 10 spots left")
--   - visibility of a peer project gated behind the applicant's VERIFIED
--     (not self-reported) skills covering its required_skills
--   - a poster-set short-answer prompt replaces the generic free-text
--     proposal, since spray-applicants won't write N specific answers
--   - a platform-wide cap of 5 active ("applied") applications per
--     student, so the anti-spray cost lands on everyone equally instead
--     of only on students who are time-poor or don't know the codes
-- ============================================================

-- ─── projects: application prompt + slot cap + live applicant count ───────────
alter table projects
  add column if not exists application_prompt text,
  add column if not exists max_applicants int default 10 not null,
  add column if not exists applicant_count int default 0 not null;

do $
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'projects'::regclass and conname = 'projects_max_applicants_check'
  ) then
    alter table projects
      add constraint projects_max_applicants_check check (max_applicants between 3 and 25);
  end if;
end $;

-- ─── students: live count of pending ("applied") applications ────────────────
alter table students
  add column if not exists active_application_count int default 0 not null;

-- ─── verified_skills_for: aggregates a student's VERIFIED (not self-reported)
--     skills across all three attestation tiers. Used to gate visibility of
--     peer projects and to rank applicants by verified-fit. Runs as the
--     caller (no security definer needed) — every source table already has
--     a "read own rows" RLS policy, so this only ever reads what the caller
--     could already read directly. ─────────────────────────────────────────
create or replace function verified_skills_for(p_student_id uuid)
returns text[]
language sql
stable
as $$
  select coalesce(array_agg(distinct lower(skill)), array[]::text[])
  from (
    select unnest(skills_used) as skill from verified_work_records
      where student_id = p_student_id and locked_at is not null and skills_used is not null
    union all
    select skill from github_evidenced_skills
      where student_id = p_student_id
    union all
    select unnest(skills_used) as skill from peer_records
      where student_id = p_student_id and locked_at is not null and skills_used is not null
  ) s
$$;

-- ─── keep projects.applicant_count and students.active_application_count in
--     sync with applications, regardless of insert path. security definer
--     because a student inserting/withdrawing their own application has no
--     UPDATE grant on `projects` or other students' rows otherwise — this is
--     the standard Postgres pattern for a maintained counter. ───────────────
create or replace function sync_application_counters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if NEW.status <> 'withdrawn' then
      update projects set applicant_count = applicant_count + 1 where id = NEW.project_id;
    end if;
    if NEW.status = 'applied' then
      update students set active_application_count = active_application_count + 1 where id = NEW.student_id;
    end if;

  elsif TG_OP = 'UPDATE' then
    if OLD.status <> 'withdrawn' and NEW.status = 'withdrawn' then
      update projects set applicant_count = greatest(applicant_count - 1, 0) where id = NEW.project_id;
    elsif OLD.status = 'withdrawn' and NEW.status <> 'withdrawn' then
      update projects set applicant_count = applicant_count + 1 where id = NEW.project_id;
    end if;

    if OLD.status = 'applied' and NEW.status <> 'applied' then
      update students set active_application_count = greatest(active_application_count - 1, 0) where id = NEW.student_id;
    elsif OLD.status <> 'applied' and NEW.status = 'applied' then
      update students set active_application_count = active_application_count + 1 where id = NEW.student_id;
    end if;

  elsif TG_OP = 'DELETE' then
    if OLD.status <> 'withdrawn' then
      update projects set applicant_count = greatest(applicant_count - 1, 0) where id = OLD.project_id;
    end if;
    if OLD.status = 'applied' then
      update students set active_application_count = greatest(active_application_count - 1, 0) where id = OLD.student_id;
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_sync_application_counters on applications;
create trigger trg_sync_application_counters
  after insert or update of status or delete on applications
  for each row execute function sync_application_counters();

-- ─── projects: gate peer-project visibility behind verified skill prereqs ─────
drop policy if exists "Anyone: read open projects" on projects;
create policy "Anyone: read open projects"
  on projects for select
  using (
    is_open = true
    and (
      poster_type <> 'student'
      or coalesce(array_length(required_skills, 1), 0) = 0
      or array(select lower(x) from unnest(required_skills) x) <@ verified_skills_for(auth.uid())
    )
  );

-- ─── applications: active-application cap (all posters) + peer-project slot
--     cap and skill gate (defense in depth — the UI already won't offer to
--     apply once these are hit, but this is the enforced backstop). ─────────
drop policy if exists "Students: insert own applications" on applications;
create policy "Students: insert own applications"
  on applications for insert
  with check (
    auth.uid() = student_id
    and coalesce((select active_application_count from students where id = auth.uid()), 0) < 5
    and exists (
      select 1 from projects p
      where p.id = applications.project_id
        and p.is_open = true
        and (
          p.poster_type <> 'student'
          or (
            (
              coalesce(array_length(p.required_skills, 1), 0) = 0
              or array(select lower(x) from unnest(p.required_skills) x) <@ verified_skills_for(auth.uid())
            )
            and p.applicant_count < p.max_applicants
          )
        )
    )
  );
