-- Project briefs: student-chosen level and track, plus the repo the brief
-- turned into.
--
-- Two problems this fixes.
--
-- First, the brief agent was picking difficulty on its own with nothing to
-- go on, so an absolute beginner and someone doing research-level work in
-- the same skill got the same project. Level and track are inputs the
-- student sets BEFORE generation, not something inferred afterwards.
--
-- Note this is separate from the existing `difficulty` column, which stays
-- what it always was: the agent's estimate of how long the project takes.
-- "How hard is this for me" and "how long will it take" are different
-- questions and a single 1-5 column was answering neither well.
--
-- Second, a brief had no way to become a repo. The UI offered "I built
-- this" on an idea suggested ten seconds ago, which is the wrong verb at
-- the wrong time — there is a whole middle state (started, repo exists,
-- still building) that had nowhere to live.

alter table project_briefs
  add column if not exists career_track   text,
  add column if not exists skill_level    text,
  add column if not exists repo_full_name text,
  add column if not exists started_at     timestamptz;

-- Constrained rather than free text: target_role was free text, and that is
-- exactly why briefs came back inconsistent — "backend", "back-end infra",
-- and "server stuff" are the same request written three ways, and the agent
-- treated them as three different ones.
alter table project_briefs
  drop constraint if exists project_briefs_skill_level_check;
alter table project_briefs
  add constraint project_briefs_skill_level_check
  check (skill_level is null or skill_level in ('beginner', 'intermediate', 'advanced', 'research'));

alter table project_briefs
  drop constraint if exists project_briefs_career_track_check;
alter table project_briefs
  add constraint project_briefs_career_track_check
  check (career_track is null or career_track in (
    'frontend', 'backend', 'systems', 'ml_ai', 'data', 'security', 'mobile', 'infrastructure'
  ));

-- Finding "is this repo already claimed by another brief" on every link.
create index if not exists project_briefs_repo_idx
  on project_briefs (student_id, repo_full_name)
  where repo_full_name is not null;
