// Free text → canonical skill_id. "ReactJS" / "react 18" / "frontend
// React" all need to resolve to the same taxonomy node.
//
// Two tiers, cheapest first:
//   1. skill_aliases cache — exact match on normalized raw string. Once any
//      variant has been resolved once, every future occurrence of that
//      exact string is a hash lookup, never a re-embed.
//   2. Voyage embedding + pgvector nearest-neighbor against skills.embedding
//      (via the match_skill_by_embedding SQL function — supabase-js can't
//      express pgvector's <=> operator natively).
//
// Above CONFIDENCE_THRESHOLD, the top match is accepted and cached into
// skill_aliases so it never needs re-resolving. Below it, nothing is
// guessed — the caller gets the candidates back for manual resolution
// (surfaced to whoever's reviewing the scan, not silently forced onto the
// nearest node).
//
// Requires a service-role client: skill_aliases has no insert policy for
// regular users by design (it's a system-computed cache, not user input).

import type { SupabaseClient } from '@supabase/supabase-js'
import { embedText, embedTexts } from '@/lib/embeddings/voyage'

// Unvalidated starting point, not an empirically derived constant — there's
// no real canonicalization traffic yet to calibrate against. Revisit once
// enough resolutions have accumulated to see where the auto-accept/
// needs-review boundary actually falls in practice.
const CONFIDENCE_THRESHOLD = 0.85
const CANDIDATE_COUNT = 3

function normalize(raw: string): string {
  return raw.trim().toLowerCase()
}

export interface CanonicalizeResult {
  resolved: boolean
  skillId: string | null
  source: 'cache' | 'embedding' | 'unresolved'
  candidates?: { skillId: string; canonicalName: string; similarity: number }[]
}

export async function canonicalizeSkill(
  supabase: SupabaseClient,
  rawText: string,
): Promise<CanonicalizeResult> {
  const normalized = normalize(rawText)
  if (!normalized) return { resolved: false, skillId: null, source: 'unresolved' }

  // Tier 1: cache
  const { data: cached } = await supabase
    .from('skill_aliases')
    .select('skill_id')
    .eq('raw_string', normalized)
    .maybeSingle()
  if (cached) {
    return { resolved: true, skillId: cached.skill_id, source: 'cache' }
  }

  // Tier 2: embed + nearest-neighbor
  const embedding = await embedText(rawText)
  const { data: matches, error } = await supabase.rpc('match_skill_by_embedding', {
    query_embedding: embedding,
    match_count: CANDIDATE_COUNT,
  })
  if (error) throw error

  const candidates = (matches ?? []).map((m: { skill_id: string; canonical_name: string; similarity: number }) => ({
    skillId: m.skill_id,
    canonicalName: m.canonical_name,
    similarity: m.similarity,
  }))

  const top = candidates[0]
  if (top && top.similarity >= CONFIDENCE_THRESHOLD) {
    const { error: insertErr } = await supabase
      .from('skill_aliases')
      .insert({ raw_string: normalized, skill_id: top.skillId })
    // A concurrent resolution racing to insert the same alias is a benign
    // conflict (raw_string is the primary key) — not a reason to fail a
    // canonicalization that otherwise succeeded.
    if (insertErr && insertErr.code !== '23505') throw insertErr
    return { resolved: true, skillId: top.skillId, source: 'embedding' }
  }

  return { resolved: false, skillId: null, source: 'unresolved', candidates }
}

/**
 * Batch form. A single repo's manifests routinely yield 40-80 raw
 * dependency names, so this is the hot path for scan latency.
 *
 * Three round-trips total regardless of batch size, where the previous
 * per-string loop cost 2N:
 *   1. ONE cache query for every normalized string at once.
 *   2. ONE Voyage call embedding every cache miss together — the API takes
 *      an array and bills per token, so N strings in one request costs the
 *      same as N requests but pays the ~300ms round trip once.
 *   3. The pgvector lookups, fanned out in parallel (each needs its own
 *      RPC since match_skill_by_embedding takes a single vector).
 *
 * Alias writes are one bulk insert at the end rather than one per hit.
 */
export async function canonicalizeSkills(
  supabase: SupabaseClient,
  rawTexts: string[],
): Promise<Map<string, CanonicalizeResult>> {
  const unique = Array.from(new Set(rawTexts.map(normalize).filter(Boolean)))
  const results = new Map<string, CanonicalizeResult>()
  if (unique.length === 0) return results

  // 1. Cache, in bulk.
  const { data: cached } = await supabase
    .from('skill_aliases')
    .select('raw_string, skill_id')
    .in('raw_string', unique)

  const cacheHits = new Map<string, string>()
  for (const row of cached ?? []) {
    cacheHits.set(row.raw_string, row.skill_id)
    results.set(row.raw_string, { resolved: true, skillId: row.skill_id, source: 'cache' })
  }

  const misses = unique.filter((raw) => !cacheHits.has(raw))
  if (misses.length === 0) return results

  // 2. Embed every miss, chunked — Voyage caps inputs per request, and a
  //    monorepo's manifests can produce a few hundred dependency names.
  //    Chunks go in parallel; the cap is on inputs per call, not calls.
  //
  //    Deliberately NOT caught: if embedding fails there is no other way to
  //    resolve an uncached string, and swallowing it would report a
  //    successful scan that silently found no skills. Let it throw so the
  //    caller records "scan failed" against that repo and the student can
  //    retry, rather than seeing an empty record and believing it.
  const EMBED_CHUNK = 96
  const chunks: string[][] = []
  for (let i = 0; i < misses.length; i += EMBED_CHUNK) {
    chunks.push(misses.slice(i, i + EMBED_CHUNK))
  }
  const embeddings = (await Promise.all(chunks.map((c) => embedTexts(c)))).flat()

  // 3. Nearest-neighbour per embedding, in parallel.
  const looked = await Promise.all(
    misses.map(async (raw, i) => {
      const { data: matches, error } = await supabase.rpc('match_skill_by_embedding', {
        query_embedding: embeddings[i],
        match_count: CANDIDATE_COUNT,
      })
      if (error) return { raw, candidates: [] as CanonicalizeResult['candidates'] & object[] }
      const candidates = (matches ?? []).map((m: { skill_id: string; canonical_name: string; similarity: number }) => ({
        skillId: m.skill_id,
        canonicalName: m.canonical_name,
        similarity: m.similarity,
      }))
      return { raw, candidates }
    }),
  )

  const newAliases: { raw_string: string; skill_id: string }[] = []
  for (const { raw, candidates } of looked) {
    const top = candidates[0]
    if (top && top.similarity >= CONFIDENCE_THRESHOLD) {
      results.set(raw, { resolved: true, skillId: top.skillId, source: 'embedding' })
      newAliases.push({ raw_string: raw, skill_id: top.skillId })
    } else {
      results.set(raw, { resolved: false, skillId: null, source: 'unresolved', candidates })
    }
  }

  if (newAliases.length > 0) {
    // ignoreDuplicates: a concurrent scan resolving the same alias is a
    // benign race on the raw_string primary key, not a failure.
    const { error } = await supabase
      .from('skill_aliases')
      .upsert(newAliases, { onConflict: 'raw_string', ignoreDuplicates: true })
    if (error) console.error('[canonicalize] alias cache write failed:', error)
  }

  return results
}
