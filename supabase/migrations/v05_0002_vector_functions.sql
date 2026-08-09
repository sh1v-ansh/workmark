-- ============================================================
--  WORKMARK MIGRATION v05_0002 — pgvector helper functions
--  Paste into Supabase → SQL Editor → Run. Incremental — safe against a
--  live v0.5 database (Phase 0 already applied).
--
--  match_skill_by_embedding and update_skill_embedding were added to
--  schema.sql during Phase 1 work, AFTER Phase 0's destructive rebuild had
--  already run against production. schema.sql is only meant to be re-run
--  as a full destructive rebuild (which must not happen again — real data
--  now exists), so these two functions were never actually applied to the
--  live database even though they're present in the repo file. This
--  migration is that missing step, following the same pattern as
--  v05_0001 for the raw_composite/current_skill_evidence addition.
-- ============================================================

-- Nearest-neighbor lookup for canonicalization (§4/§5, Phase 1) —
-- supabase-js can't express the pgvector <=> operator natively, so this is
-- the one place a raw SQL function is required rather than a plain query.
-- No vector index (ivfflat/hnsw) on skills.embedding: at ~180 rows a
-- sequential scan is faster than any index's overhead, and ivfflat needs
-- representative data present to tune its `lists` parameter sensibly
-- anyway. Revisit only if the taxonomy grows by an order of magnitude.
--
-- deprecated_at filter matters here specifically: a deprecated skill still
-- exists (old evidence rows reference it via skill_id), but new
-- canonicalization should never route a fresh match onto a dead end —
-- merged_into_id is where that traffic should land instead.
create or replace function match_skill_by_embedding(query_embedding vector(1024), match_count int default 3)
returns table (skill_id text, canonical_name text, similarity float)
language sql stable
as $$
  select id, canonical_name, 1 - (embedding <=> query_embedding) as similarity
  from skills
  where embedding is not null and deprecated_at is null
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- Writing a `vector` column through a plain PostgREST update is a real
-- trouble spot — the JSON array supabase-js sends has no guaranteed cast
-- to pgvector's vector type, and failure modes range from a clear error to
-- silently wrong data depending on client/PostgREST version. Routing the
-- write through this function sidesteps the ambiguity entirely: the cast
-- from float8[] to vector happens explicitly, in SQL, where it's
-- unambiguous.
--
-- Deliberately NOT security definer: the only caller is the backfill
-- script, which already runs as service_role and bypasses RLS on its own.
-- Making this security definer would let it update any skill's embedding
-- from any caller able to invoke the RPC at all (anon/authenticated by
-- default) — a real privilege-escalation surface for zero benefit, since
-- nothing about the actual use case needs it.
create or replace function update_skill_embedding(p_skill_id text, p_embedding float8[])
returns void
language plpgsql
as $$
begin
  update skills set embedding = p_embedding::vector(1024) where id = p_skill_id;
end;
$$;
