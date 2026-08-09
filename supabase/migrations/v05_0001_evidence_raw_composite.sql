-- ============================================================
--  WORKMARK MIGRATION v05_0001 — raw composite storage + current-evidence view
--  Paste into Supabase → SQL Editor → Run. Incremental — safe against a
--  live v0.5 database (Phase 0 already applied).
--
--  Surfaced while building percentile calibration (Phase 1, task #14):
--  ranking a new evidence row against prior evidence for the same skill
--  needs something to rank against, but skill_evidence only stored the
--  already-bucketed 1-5 difficulty_cleared, not the raw composite score
--  that produced it. Without this, percentile-within-skill has nothing
--  to compute a percentile of.
-- ============================================================

alter table skill_evidence
  add column if not exists raw_composite numeric;

-- "Current" state of skill_evidence — every row minus whichever ones have
-- been superseded by a correction (a newer row pointing back at them via
-- corrects_evidence_id). This is what depth/matching/percentile
-- calculations should read from; the raw table stays the full audit
-- history. RLS on skill_evidence still applies transparently through this
-- view — a plain view inherits the underlying table's policies for the
-- querying role, it isn't a bypass.
create or replace view current_skill_evidence as
select se.*
from skill_evidence se
where not exists (
  select 1 from skill_evidence corrector where corrector.corrects_evidence_id = se.id
);
