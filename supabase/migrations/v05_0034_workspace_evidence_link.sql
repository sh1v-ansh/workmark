-- ============================================================
--  WORKMARK MIGRATION v05_0034 — verified project work reaches the record
--  Paste into Supabase → SQL Editor → Run. Incremental and safe against a
--  live database; every statement is idempotent.
--
--  Until now a project could produce a board full of Verified cards and none
--  of it appeared on /me. The workspace feature measured everything and told
--  nobody, which is the one failure mode that makes the whole thing pointless
--  — a student does eight weeks of real work and their record is unchanged.
--
--  Evidence already has a shape: artifacts + skill_evidence + evidence_audit,
--  written by src/lib/skills/evidence.ts and minted at engagement close-out.
--  This migration does not add a second pipeline alongside it. It adds the
--  two columns that let the existing one point at a workspace, exactly as it
--  already points at an engagement.
-- ============================================================

-- ─── Which project produced this ────────────────────────────────────────────
-- Nullable, like engagement_id: most artifacts come from a solo repo scan and
-- belong to no project at all.
--
-- ON DELETE SET NULL rather than CASCADE, and the difference matters. Evidence
-- is a claim about what somebody did at a moment in time. A project row going
-- away does not make the work not have happened, and cascading would quietly
-- delete a student's record as a side effect of tidying up a workspace.
alter table artifacts
  add column if not exists workspace_id uuid references workspaces(id) on delete set null;

alter table skill_evidence
  add column if not exists workspace_id uuid references workspaces(id) on delete set null;

-- ─── A tier for work that was planned, checked and confirmed ────────────────
-- The existing tiers describe how the work was found:
--
--   tier_0         a repo the student scanned themselves
--   tier_0_5       the same, with other contributors present
--   listing_driven somebody hired them and accepted the result
--
-- Workspace work is stronger than any of them, and for a reason that is worth
-- writing down: the acceptance criteria were fixed BEFORE the work started.
-- Every other tier judges a finished repository against itself. Here there is
-- a claim made in advance, a submission, and a check against that claim —
-- which is the difference between "this exists" and "this does what it said".
--
-- Dropped by what it says rather than by what it is probably called.
-- Postgres names an inline CHECK `<table>_<column>_check`, which is almost
-- always right — and when it is not, `drop constraint if exists` succeeds
-- silently, the new constraint is added alongside the old one, and the old one
-- goes on rejecting 'workspace_verified'. The failure would look like a
-- migration that ran cleanly and a close-out that fails in production.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.artifacts'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%listing_driven%'
  loop
    execute format('alter table artifacts drop constraint %I', c.conname);
  end loop;
end $$;

alter table artifacts add constraint artifacts_tier_check
  check (tier in ('tier_0', 'tier_0_5', 'listing_driven', 'workspace_verified'));

-- ─── Lookups ────────────────────────────────────────────────────────────────
-- getOrCreateArtifact scopes by (student, repo, workspace) so a repo that has
-- already produced solo evidence gets a SECOND artifact for the project rather
-- than overwriting the student's own record of it. Those are two different
-- claims about two different pieces of work.
create index if not exists artifacts_workspace_idx
  on artifacts (student_id, workspace_id) where workspace_id is not null;

-- "What did this project put on people's records" — asked by the close-out
-- summary, and the query a dispute starts from.
create index if not exists skill_evidence_workspace_idx
  on skill_evidence (workspace_id) where workspace_id is not null;

-- ─── When a project's evidence was actually written ─────────────────────────
-- Closing a project scans the repository once per member, which is several
-- GitHub round trips and can outlast a 60-second function on a four-person
-- team. So closing and minting are separated: the close itself is one fast
-- write, and this column records whether the slow half finished.
--
-- Null on a closed project means the nightly pass should try again. Without
-- it the only recovery from a timeout would be a student noticing their
-- record never updated and telling somebody.
alter table workspaces
  add column if not exists evidence_minted_at timestamptz;

create index if not exists workspaces_awaiting_evidence_idx
  on workspaces (closed_at) where status = 'closed' and evidence_minted_at is null;

-- ─── Notes for whoever reads this next ──────────────────────────────────────
--
-- difficulty_cleared is deliberately NOT raised by task difficulty. It stays
-- whatever computeDifficultyLevel derives from the repository, because a
-- student setting their own task to difficulty 9 must never be able to move
-- their own record. What the verified-task history buys instead is
-- source_agreement = 2: the repository scan and the acceptance-criteria checks
-- are two genuinely independent readings of the same work, which is precisely
-- what that column was added to count.
--
-- No RLS changes. Both tables already have their policies, and both columns
-- are written only under the service role — as every other column on them is.
