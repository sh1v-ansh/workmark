-- ============================================================
--  WORKMARK MIGRATION v05_0003 — explicit grant on current_skill_evidence
--  Paste into Supabase → SQL Editor → Run. Incremental — safe against a
--  live v0.5 database (Phase 0 already applied).
--
--  Every other object in schema.sql relies on Supabase's default-privilege
--  propagation (new tables inherit grants to anon/authenticated/service_role
--  automatically). That's confirmed working for base tables, but views are
--  a real edge case in some Postgres/Supabase setups where the default
--  privilege rule doesn't propagate the same way. Surfaced while
--  investigating a GitHub scan that reported evidence written but the
--  verification page showed none of it — this closes off "the view simply
--  isn't selectable" as a possible cause. RLS (auth.uid() = student_id,
--  inherited transparently from skill_evidence) still does the actual
--  row-level restriction; this grant only permits the SELECT statement
--  itself to run.
-- ============================================================

grant select on current_skill_evidence to anon, authenticated;
