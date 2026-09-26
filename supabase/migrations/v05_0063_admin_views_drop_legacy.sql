-- ============================================================
--  WORKMARK MIGRATION v05_0063 — readable admin views, legacy columns out
--  Paste into Supabase → SQL Editor → Run.
--
--  1. Three views for reading the database by hand (Supabase → Table
--     editor → Views): evidence with names, skills per student, and scan
--     status per student. security_invoker, and closed to the app's
--     signed-in and anonymous roles: only the dashboard (postgres) and the
--     service role can read them.
--  2. Drops five students columns nothing writes any more: skills, gpa,
--     visa_type, github_url, available_from. The block first prints how
--     many rows had anything in each, so the SQL editor output records
--     what was removed.
-- ============================================================

-- ── 1. Views ──────────────────────────────────────────────────────────────

-- evidence_audit with who and what. A view rather than a name column: names
-- change and accounts get deleted, and a copied name would go stale.
create or replace view admin_evidence_audit with (security_invoker = true) as
select
  ea.id,
  ea.extracted_at,
  st.full_name       as student_name,
  se.student_id,
  sk.canonical_name  as skill,
  se.difficulty_cleared as level,
  a.repo_full_name,
  ea.source,
  ea.raw_input,
  ea.evidence_id
from evidence_audit ea
join skill_evidence se on se.id = ea.evidence_id
left join students st on st.id = se.student_id
left join skills sk on sk.id = se.skill_id
left join artifacts a on a.id = se.artifact_id;

-- Who has what: one row per student per current skill, best level first.
create or replace view admin_student_skills with (security_invoker = true) as
select
  st.full_name       as student_name,
  cse.student_id,
  sk.canonical_name  as skill,
  max(cse.difficulty_cleared) as best_level,
  count(distinct cse.artifact_id) as repos,
  string_agg(distinct a.repo_full_name, ', ') as found_in,
  max(cse.created_at) as last_updated
from current_skill_evidence cse
join students st on st.id = cse.student_id
left join skills sk on sk.id = cse.skill_id
left join artifacts a on a.id = cse.artifact_id
group by st.full_name, cse.student_id, sk.canonical_name;

-- Scan status: one row per student, with a plain-words answer to "did the
-- scan fail, or is their GitHub just empty?"
create or replace view admin_scan_status with (security_invoker = true) as
with last_job as (
  select distinct on (student_id)
    student_id, status, created_at as started_at, finished_at, error, total_steps, completed_steps, steps
  from jobs
  where kind = 'github_scan'
  order by student_id, created_at desc
),
step_counts as (
  select
    j.student_id,
    count(*) filter (where s->>'status' = 'failed')                          as repos_failed,
    count(*) filter (where s->>'status' = 'done' and s->>'detail' ilike 'skipped%') as repos_skipped,
    count(*) filter (where s->>'status' = 'done' and s->>'detail' not ilike 'skipped%') as repos_read
  from last_job j, jsonb_array_elements(j.steps) s
  group by j.student_id
),
grants as (
  select student_id,
    count(*) filter (where revoked_at is null)                  as repos_shared,
    count(*) filter (where revoked_at is null and scan_enabled) as repos_enabled
  from github_repo_grants
  group by student_id
),
skills as (
  select student_id, count(distinct skill_id) as verified_skills
  from current_skill_evidence
  group by student_id
)
select
  st.full_name as student_name,
  st.id        as student_id,
  gc.github_login,
  gc.connected_at,
  coalesce(g.repos_shared, 0)  as repos_shared,
  coalesce(g.repos_enabled, 0) as repos_enabled,
  j.status     as last_scan_status,
  j.started_at as last_scan_started,
  j.finished_at as last_scan_finished,
  coalesce(sc.repos_read, 0)    as repos_read,
  coalesce(sc.repos_skipped, 0) as repos_skipped,
  coalesce(sc.repos_failed, 0)  as repos_failed,
  coalesce(sk.verified_skills, 0) as verified_skills,
  j.error as last_scan_error,
  case
    when gc.student_id is null then 'GitHub not connected'
    when coalesce(g.repos_shared, 0) = 0 then 'Connected, but shared no repositories'
    when coalesce(g.repos_enabled, 0) = 0 then 'Shared only private repos and switched none on'
    when j.status is null then 'Never scanned'
    when j.status in ('queued', 'running') then 'Scan running now'
    when j.status = 'failed' then 'Last scan failed (see last_scan_error)'
    when j.status = 'cancelled' then 'Last scan was stopped'
    when coalesce(sk.verified_skills, 0) > 0 and coalesce(sc.repos_failed, 0) > 0 then 'Has skills; some repos failed to read'
    when coalesce(sk.verified_skills, 0) > 0 then 'Has skills'
    when coalesce(sc.repos_failed, 0) > 0 then 'Scanned, repos failed and nothing found'
    else 'Scanned, nothing found (empty repos, forks, or no commits of theirs)'
  end as summary
from students st
left join github_connections gc on gc.student_id = st.id
left join grants g on g.student_id = st.id
left join last_job j on j.student_id = st.id
left join step_counts sc on sc.student_id = st.id
left join skills sk on sk.student_id = st.id;

revoke all on admin_evidence_audit, admin_student_skills, admin_scan_status from anon, authenticated;

-- ── 2. Legacy columns ─────────────────────────────────────────────────────

do $$
declare
  n_skills int; n_gpa int; n_visa int; n_url int; n_from int;
begin
  select count(*) filter (where skills is not null and cardinality(skills) > 0),
         count(*) filter (where gpa is not null),
         count(*) filter (where visa_type is not null),
         count(*) filter (where github_url is not null and github_url <> ''),
         count(*) filter (where available_from is not null)
    into n_skills, n_gpa, n_visa, n_url, n_from
    from students;
  raise notice 'Rows with data being dropped — skills: %, gpa: %, visa_type: %, github_url: %, available_from: %',
    n_skills, n_gpa, n_visa, n_url, n_from;
end $$;

alter table public.students
  drop column if exists skills,
  drop column if exists gpa,
  drop column if exists visa_type,
  drop column if exists github_url,
  drop column if exists available_from;
