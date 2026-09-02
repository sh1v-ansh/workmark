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
import { isNoise, normalizeName } from '@/lib/skills/noise'
import { SEED_ALIASES } from '@/lib/skills/seed-aliases'

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
  source: 'cache' | 'exact' | 'embedding' | 'unresolved'
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
export interface ScanContext {
  studentId: string
  repoFullName: string
}

export async function canonicalizeSkills(
  supabase: SupabaseClient,
  rawTexts: string[],
  /**
   * Whose scan this is. Optional because the dispute path re-derives skills
   * without wanting to record sightings, but when present it's what lets the
   * review queue say a miss cost three students rather than just that it
   * happened.
   */
  context?: ScanContext,
): Promise<Map<string, CanonicalizeResult>> {
  const results = new Map<string, CanonicalizeResult>()

  // 0. Drop noise before anything costs money or attention.
  //
  //    `import os`, `import utils`, `eslint` — standard library, the
  //    student's own sibling files, and build tooling every project has.
  //    These used to be embedded (paid for), fail to match, and land in the
  //    review queue as work for a human whose only possible answer is "no,
  //    that isn't a skill". Dropped silently: an unresolved entry is a
  //    request for a decision, and there is no decision here.
  const unique = Array.from(new Set(
    rawTexts.map(normalize).filter((r) => r && !isNoise(r)),
  ))
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

  let misses = unique.filter((raw) => !cacheHits.has(raw))
  if (misses.length === 0) return results

  // 2. Exact match on the normalized name, before any similarity scoring.
  //
  //    This is the fix for the biggest class of failure. Similarity is poor
  //    at short bare tokens: measured on real scans, `numpy` scored 70%
  //    against NumPy, `docker` 75% against Docker, `typescript` 81% against
  //    TypeScript — every one correct, every one under the 0.85 bar, every
  //    one silently dropped from a student's record. Comparing normalized
  //    strings settles those with no model involved and no ambiguity.
  const exact = await resolveExact(supabase, misses)
  const newAliases: { raw_string: string; skill_id: string }[] = []
  for (const [raw, skillId] of Array.from(exact.entries())) {
    results.set(raw, { resolved: true, skillId, source: 'exact' })
    newAliases.push({ raw_string: raw, skill_id: skillId })
  }
  misses = misses.filter((raw) => !exact.has(raw))

  if (misses.length === 0) {
    await writeAliases(supabase, newAliases)
    return results
  }

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

  const unresolved: { raw: string; candidates: CanonicalizeResult['candidates'] }[] = []
  for (const { raw, candidates } of looked) {
    const top = candidates[0]
    if (top && top.similarity >= CONFIDENCE_THRESHOLD) {
      results.set(raw, { resolved: true, skillId: top.skillId, source: 'embedding' })
      newAliases.push({ raw_string: raw, skill_id: top.skillId })
    } else {
      results.set(raw, { resolved: false, skillId: null, source: 'unresolved', candidates })
      unresolved.push({ raw, candidates })
    }
  }

  // Anything that didn't clear the bar used to be returned to the caller and
  // then dropped on the floor — so students lost skills and there was no way
  // to find out which, or how often. Recording them makes the misses
  // reviewable, and the seen count says which are common enough to be worth
  // adding to the taxonomy.
  if (unresolved.length > 0) await recordUnresolved(supabase, unresolved, context)

  await writeAliases(supabase, newAliases)

  return results
}

/**
 * Resolve names by string, not by similarity.
 *
 * Three passes, cheapest first, all case- and punctuation-insensitive:
 *   1. The hand-curated seed table (postgres -> PostgreSQL, torch -> PyTorch).
 *   2. The taxonomy id itself (`numpy` is literally the id of NumPy).
 *   3. The canonical display name normalized the same way (`Next.js` -> nextjs).
 *
 * Everything matched here is written to skill_aliases, so the work happens
 * once per name across the whole platform rather than once per scan.
 */
async function resolveExact(
  supabase: SupabaseClient,
  raws: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const remaining: string[] = []

  for (const raw of raws) {
    const seeded = SEED_ALIASES[normalizeName(raw)]
    if (seeded) out.set(raw, seeded)
    else remaining.push(raw)
  }
  if (remaining.length === 0) return out

  const { data: skills } = await supabase
    .from('skills')
    .select('id, canonical_name')
    .is('deprecated_at', null)
  if (!skills) return out

  const byNormalized = new Map<string, string>()
  for (const s of skills) {
    byNormalized.set(normalizeName(s.id), s.id)
    // The id wins on collision — it's the stable key, and a display name
    // like "HTML/CSS" normalizes to something a package could also produce.
    const nameKey = normalizeName(s.canonical_name)
    if (!byNormalized.has(nameKey)) byNormalized.set(nameKey, s.id)
  }

  for (const raw of remaining) {
    const hit = byNormalized.get(normalizeName(raw))
    if (hit) out.set(raw, hit)
  }
  return out
}

async function writeAliases(
  supabase: SupabaseClient,
  aliases: { raw_string: string; skill_id: string }[],
): Promise<void> {
  if (aliases.length === 0) return
  // ignoreDuplicates: a concurrent scan resolving the same alias is a benign
  // race on the raw_string primary key, not a failure.
  const { error } = await supabase
    .from('skill_aliases')
    .upsert(aliases, { onConflict: 'raw_string', ignoreDuplicates: true })
  if (error) console.error('[canonicalize] alias cache write failed:', error)
}

/**
 * Record names the matcher couldn't place.
 *
 * Upsert-with-increment rather than plain insert: the same unmatched string
 * shows up in every repo that uses it, and one row per occurrence would bury
 * the signal that matters — how many students hit this. The count is what
 * says whether a missing name is a one-off typo or a gap in the taxonomy.
 *
 * Best-effort. Failing to file a miss must never fail the scan that found
 * it; the student's other skills are still worth writing.
 */
async function recordUnresolved(
  supabase: SupabaseClient,
  items: { raw: string; candidates: CanonicalizeResult['candidates'] }[],
  context?: ScanContext,
): Promise<void> {
  try {
    const now = new Date().toISOString()
    // Insert first, ignoring rows that already exist, then bump the counters
    // for whatever was already there. Two statements rather than a bulk
    // upsert because the count has to increment, not be overwritten.
    await supabase.from('unresolved_skills').upsert(
      items.map((i) => ({
        raw_string: i.raw,
        candidates: i.candidates ?? [],
        seen_count: 1,
        first_seen_at: now,
        last_seen_at: now,
      })),
      { onConflict: 'raw_string', ignoreDuplicates: true },
    )
    if (context) {
      // Per-row rather than bulk: each call also folds this student and repo
      // into the row's affected list, deduped in SQL so two students'
      // concurrent scans can't overwrite each other.
      await Promise.all(items.map((i) =>
        supabase.rpc('record_unresolved_sighting', {
          p_raw_string: i.raw,
          p_student_id: context.studentId,
          p_repo: context.repoFullName,
        }),
      ))
    } else {
      await supabase.rpc('bump_unresolved_skills', { p_raw_strings: items.map((i) => i.raw) })
    }
  } catch (err) {
    console.error('[canonicalize] could not record unresolved skills:', err)
  }
}
