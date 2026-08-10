// The student agent's analysis half (§8).
//
// Everything else in the product answers "how do I compare on THIS
// listing". This answers the reverse: "I want to work on X — what am I
// missing, and what should I do about it?"
//
// Deliberately deterministic. No model reads any of this; the target
// vector is derived by counting what open listings actually ask for, and
// the gap is a set difference against the student's evidence. An agent
// only enters at the very end, to write a project brief for a named
// skill — and that's a separate, already-audited call.
//
// The honest limitation, stated in the UI rather than hidden: at low
// listing counts the target vector is derived from very few listings and
// is closer to a sample than a distribution. §8 says to say so when the
// data is thin, so `derivedFromListings` is returned and displayed.

import type { SupabaseClient } from '@supabase/supabase-js'
import { getStudentDepth, type SkillDepth } from './depth'

/** Below this many contributing listings, the target vector is a sample,
 *  not a distribution, and the UI says so. */
export const THIN_DATA_THRESHOLD = 5

export interface SkillDemand {
  skillId: string
  canonicalName: string
  /** How many open listings ask for it. */
  listingCount: number
  /** Sum of required_level across those listings — importance, not count. */
  totalImportance: number
  /** The student's depth, or null when they have no evidence at all. */
  studentDepth: number | null
}

export interface GoalAnalysis {
  /** Every skill open listings ask for, most in-demand first. */
  demand: SkillDemand[]
  /** Skills in demand that the student has NO evidence in — the gap. */
  gaps: SkillDemand[]
  /** Skills the student has that are in demand — what's working. */
  strengths: SkillDemand[]
  /** How many open listings the target vector was derived from. */
  derivedFromListings: number
  /** True when that number is too small to generalize from. */
  thinData: boolean
}

/**
 * Builds a target skill vector from the open listings the student could
 * plausibly want, then diffs it against their evidence.
 *
 * `listingIds` is the caller's choice of scope — all open listings, or a
 * filtered subset. Keeping the filter outside this function means the
 * page can decide what "backend roles" means without this having an
 * opinion about job titles it can't actually verify.
 */
export async function analyzeGoal(
  supabase: SupabaseClient,
  studentId: string,
  listingIds: string[],
): Promise<GoalAnalysis> {
  const depth = await getStudentDepth(supabase, studentId)

  if (listingIds.length === 0) {
    return { demand: [], gaps: [], strengths: [], derivedFromListings: 0, thinData: true }
  }

  const { data: requirements, error } = await supabase
    .from('listing_requirements')
    .select('listing_id, skill_id, required_level')
    .in('listing_id', listingIds)
  if (error) throw error

  const rows = requirements ?? []
  const bySkill = new Map<string, { listings: Set<string>; importance: number }>()
  for (const r of rows) {
    if (!bySkill.has(r.skill_id)) bySkill.set(r.skill_id, { listings: new Set(), importance: 0 })
    const entry = bySkill.get(r.skill_id)!
    entry.listings.add(r.listing_id)
    entry.importance += r.required_level
  }

  const skillIds = Array.from(bySkill.keys())
  const { data: skillRows } = skillIds.length
    ? await supabase.from('skills').select('id, canonical_name').in('id', skillIds)
    : { data: [] as { id: string; canonical_name: string }[] }
  const nameById = new Map((skillRows ?? []).map((s) => [s.id, s.canonical_name]))

  const demand: SkillDemand[] = skillIds
    .map((skillId) => {
      const entry = bySkill.get(skillId)!
      const d: SkillDepth | undefined = depth.get(skillId)
      return {
        skillId,
        canonicalName: nameById.get(skillId) ?? skillId,
        listingCount: entry.listings.size,
        totalImportance: entry.importance,
        studentDepth: d ? d.depth : null,
      }
    })
    // Ranked by total importance rather than raw listing count: one
    // listing calling a skill essential is a stronger signal than three
    // listing it as nice-to-have.
    .sort((a, b) => b.totalImportance - a.totalImportance || a.canonicalName.localeCompare(b.canonicalName))

  const contributingListings = new Set(rows.map((r) => r.listing_id)).size

  return {
    demand,
    // §8: a gap under presence-based matching is a skill with NO evidence
    // at all — not a depth-threshold subtraction, since no such threshold
    // exists in MVP.
    gaps: demand.filter((d) => d.studentDepth === null),
    strengths: demand.filter((d) => d.studentDepth !== null),
    derivedFromListings: contributingListings,
    thinData: contributingListings < THIN_DATA_THRESHOLD,
  }
}

/**
 * How much of a listing's unmet requirement weight a student would close
 * by applying to it — the ranking key for "what should I do next".
 *
 * Listings are ranked by how well the student ALREADY fits, not by how
 * much they'd learn: the gap analysis tells them what to go build, and
 * the recommendation tells them where they can act today. Conflating the
 * two produces the useless suggestion of applying to the listing you're
 * least qualified for.
 */
export function gapClosedByListing(
  requirements: { skillId: string; requiredLevel: number }[],
  depthBySkill: Map<string, SkillDepth>,
): { matchedImportance: number; totalImportance: number; share: number } {
  const totalImportance = requirements.reduce((n, r) => n + r.requiredLevel, 0)
  const matchedImportance = requirements
    .filter((r) => depthBySkill.has(r.skillId))
    .reduce((n, r) => n + r.requiredLevel, 0)
  return {
    matchedImportance,
    totalImportance,
    share: totalImportance === 0 ? 0 : matchedImportance / totalImportance,
  }
}
