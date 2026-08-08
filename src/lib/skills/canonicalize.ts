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
import { embedText } from '@/lib/embeddings/voyage'

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

/** Batch form — canonicalizes many raw strings, deduping identical inputs
 *  before doing any embedding work. */
export async function canonicalizeSkills(
  supabase: SupabaseClient,
  rawTexts: string[],
): Promise<Map<string, CanonicalizeResult>> {
  const unique = Array.from(new Set(rawTexts.map(normalize).filter(Boolean)))
  const results = new Map<string, CanonicalizeResult>()
  // Sequential, not Promise.all — cache writes from an earlier resolution
  // in this same batch should be visible to later ones (two inputs that
  // normalize differently but embed to the same skill shouldn't both pay
  // the embedding cost if avoidable... they still will today, since the
  // cache key is the raw string, not the resolved skill. Left sequential
  // for now because scan volume per student is small; revisit if batch
  // sizes grow enough for embedding-call latency to matter.
  for (const raw of unique) {
    results.set(raw, await canonicalizeSkill(supabase, raw))
  }
  return results
}
