-- ============================================================
--  WORKMARK MIGRATION v05_0006 — disputes + evidence retraction
--  Paste into Supabase → SQL Editor → Run. Incremental — safe against a
--  live v0.5 database (Phase 0 already applied).
--
--  The write-path FCRA machinery (append-only evidence, consents,
--  disclosure_log, evidence_audit) has existed since Phase 0 because it
--  cannot be backfilled. This adds the read path: the consumer's right
--  to dispute what's in their file (§611) and to have it reinvestigated.
--
--  Two pieces:
--
--  1. skill_evidence.retracted_at — the missing third outcome. A
--     reinvestigation can conclude "the value was wrong" (a correction
--     row, which already worked) or "this shouldn't be here at all",
--     and until now there was no way to express the latter without
--     deleting a row, which the append-only trigger forbids and which
--     would destroy the audit trail a dispute exists to produce. A
--     retraction is a NEW row that supersedes the original and marks
--     itself retracted, so nothing displays and everything is still on
--     the record.
--
--  2. disputes — the dispute itself, its category, and its resolution.
-- ============================================================

alter table skill_evidence
  add column if not exists retracted_at timestamptz;

-- Now excludes retracted rows as well as superseded ones. Same view
-- everything already reads from, so retraction takes effect everywhere
-- (depth, matching, profiles) without touching a single query.
create or replace view current_skill_evidence as
select se.*
from skill_evidence se
where se.retracted_at is null
  and not exists (
    select 1 from skill_evidence corrector where corrector.corrects_evidence_id = se.id
  );

grant select on current_skill_evidence to anon, authenticated;

create table if not exists disputes (
  id                     uuid default gen_random_uuid() primary key,
  student_id             uuid references students(id) on delete cascade not null,
  -- Exactly one of these is normally set: a dispute is about a specific
  -- evidence row, or about a specific disclosure, or (both null) about
  -- the file as a whole.
  evidence_id            uuid references skill_evidence(id),
  disclosure_id          uuid references disclosure_log(id),
  category               text not null check (category in (
    'inaccurate_level',        -- "the level is wrong"
    'skill_not_demonstrated',  -- "this repo doesn't show that skill"
    'not_my_work',             -- "I didn't write this"
    'wrong_attribution',       -- "those commits aren't mine"
    'disclosure_unauthorized', -- "I never consented to that disclosure"
    'other'
  )),
  detail                 text not null,
  status                 text not null default 'open' check (status in (
    'open',                 -- filed, not yet reinvestigated
    'reinvestigating',      -- recompute in flight
    'resolved_corrected',   -- recompute disagreed; a correction row was written
    'resolved_retracted',   -- recompute found no basis; evidence retracted
    'resolved_verified',    -- recompute agreed with what was there
    'resolved_manual'       -- not machine-checkable; closed by a human
  )),
  filed_at               timestamptz default now() not null,
  -- FCRA §611 gives 30 days to reinvestigate. Stored rather than
  -- computed at read time so the clock is visible in the row itself and
  -- an overdue dispute is a plain query, not a report someone has to
  -- remember to run.
  due_at                 timestamptz default (now() + interval '30 days') not null,
  resolved_at            timestamptz,
  resolution_note        text,
  -- The correction/retraction row this dispute produced, when it produced one.
  resolution_evidence_id uuid references skill_evidence(id)
);

create index if not exists idx_disputes_student  on disputes(student_id);
create index if not exists idx_disputes_status   on disputes(status);
create index if not exists idx_disputes_evidence on disputes(evidence_id);

alter table disputes enable row level security;

-- Students read and file their own. They never UPDATE: a consumer
-- editing the status of their own dispute would make the resolution
-- record worthless. Resolution is service-role only.
create policy "Students: read own disputes"
  on disputes for select using (auth.uid() = student_id);

create policy "Students: file own disputes"
  on disputes for insert with check (auth.uid() = student_id);

-- Students may revoke a consent they granted. Revocation is not
-- deletion — the row stays, with revoked_at set, because "this was
-- consented to at the time" remains true of disclosures already made.
create policy "Students: revoke own consent"
  on consents for update
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);
