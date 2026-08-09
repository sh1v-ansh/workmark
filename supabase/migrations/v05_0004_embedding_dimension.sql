-- ============================================================
--  WORKMARK MIGRATION v05_0004 — fix skills.embedding vector dimension
--  Paste into Supabase → SQL Editor → Run. Incremental — safe against a
--  live v0.5 database (Phase 0 already applied).
--
--  Same root cause as v05_0002/v05_0003: skills.embedding was defined as
--  vector(512) (voyage-3-lite) at the time Phase 0's rebuild actually ran
--  against production, then changed to vector(1024) in schema.sql during
--  Phase 1 (switching to voyage-4's default output dimension) — a change
--  that, like the others, never got its own migration. The live column is
--  still vector(512), which is why the taxonomy embeddings backfill fails
--  with "expected 512 dimensions, not 1024".
--
--  Safe to run: embedding is null on every row right now (the backfill
--  has never successfully completed), so this is a pure type change with
--  no data to convert.
-- ============================================================

alter table skills
  alter column embedding type vector(1024);
