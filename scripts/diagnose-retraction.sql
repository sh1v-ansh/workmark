-- Why did a rescan not change anything?
--
-- Run all five. Together they say which of the five possible answers it is,
-- and they are in the order that narrows it fastest. I have guessed at this
-- twice and been wrong twice; this stops the guessing.
--
-- Replace the email in Q1 and paste the id into the rest.

-- ─── 1. Who ─────────────────────────────────────────────────────────────────
select id from auth.users where email = 'YOU@YOUR-UNIVERSITY.edu';


-- ─── 2. Is the old row actually still current? ──────────────────────────────
-- current_skill_evidence hides a row that is retracted OR superseded by a
-- correction. If the levels here are 3 and created_at is old, no new row was
-- written at all. If there are TWO rows for one skill and artifact, the
-- correction did not point back at the old one and both are live — which
-- would look exactly like "nothing changed".
select
  s.canonical_name,
  e.id,
  e.difficulty_cleared,
  e.raw_composite,
  e.artifact_id,
  e.created_at,
  e.retracted_at,
  e.corrects_evidence_id
from current_skill_evidence e
join skills s on s.id = e.skill_id
where e.student_id = 'PASTE-ID'
  and s.id in ('cryptography', 'r-lang')
order by s.canonical_name, e.created_at desc;


-- ─── 3. The whole history for those two, corrections included ───────────────
-- Reading the raw table rather than the view. If rows appeared here with
-- today's date but question 2 still shows the old ones, the write worked and
-- the supersede link is what is broken.
select
  s.canonical_name,
  e.id,
  e.difficulty_cleared,
  e.corrects_evidence_id,
  e.retracted_at,
  e.created_at
from skill_evidence e
join skills s on s.id = e.skill_id
where e.student_id = 'PASTE-ID'
  and s.id in ('cryptography', 'r-lang')
order by s.canonical_name, e.created_at;


-- ─── 4. Did the scan touch the same artifact? ───────────────────────────────
-- Retraction is scoped to one artifact_id, so a repo that produced a SECOND
-- artifact row on rescan would leave the first one's evidence untouched
-- forever — nothing would ever be compared against it.
select
  a.id,
  a.repo_full_name,
  a.tier,
  a.engagement_id,
  a.workspace_id,
  a.created_at,
  (select count(*) from current_skill_evidence e where e.artifact_id = a.id) as live_skills
from artifacts a
where a.student_id = 'PASTE-ID'
order by a.repo_full_name, a.created_at;


-- ─── 5. Is R still resolving at all? ────────────────────────────────────────
-- If the alias is gone and R still appears, something else is minting it —
-- and if the alias is still there, the delete did not match what I expected.
select raw_string, skill_id, resolved_at
from skill_aliases
where skill_id = 'r-lang';
