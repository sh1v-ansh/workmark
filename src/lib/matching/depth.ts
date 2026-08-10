// Per-skill depth (§6): how much demonstrated evidence a student has in
// one skill, reduced to a single comparable number.
//
//   depth(u,s) = Σ_k (tier_weight_k × difficulty_cleared_k)
//                    × 0.85^(k-1)
//                    × recency_k
//
// Evidence is sorted descending by weighted difficulty first, so k is a
// rank, not an arbitrary order: the student's strongest piece of evidence
// takes the full multiplier and each subsequent one takes 15% less.
//
// The three parts do different jobs and it matters that they stay
// separable:
//
//   tier_weight        0.4 solo repo / 0.5 multi-contributor and
//                      listing-driven today; 0.8 faculty / 1.0 employer
//                      once attestation exists. Keeps self-evidenced work
//                      ranked below attested work automatically as later
//                      tiers switch on. (Generated column: base ×
//                      independence × paid; the latter two are 1.0 in MVP.)
//   difficulty_cleared 1-5, capped at 3 for self-evidenced work.
//   0.85^(k-1)         declining marginal information, NOT a penalty.
//                      Every piece of evidence adds; none is ever zero or
//                      negative. The tenth still contributes ~23% of face
//                      value. It exists so three hard engagements outrank
//                      twelve trivial ones on depth specifically.
//   recency            work from four years ago is weaker evidence about
//                      what someone can do now, but it is not worthless —
//                      the floor is 0.7, never 0.
//
// Reads current_skill_evidence (the view), so superseded corrections and
// retracted rows are already excluded. Never reads skill_priors: a prior
// means "this appeared in a repo you had access to"; evidence means "you
// committed to a repo demonstrating it". Only the latter is a claim about
// the student.

import type { SupabaseClient } from '@supabase/supabase-js'

const RANK_DECAY = 0.85

/** §6's recency bands, in months. */
export function recencyMultiplier(createdAt: string, now: Date = new Date()): number {
  const months = (now.getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30.44)
  if (months < 6) return 1.0
  if (months < 12) return 0.9
  if (months < 24) return 0.8
  return 0.7
}

/** Verification methods that count as "proof it runs" for confidence (§7). */
const VERIFIED_METHODS = new Set(['deployment', 'package', 'ci', 'attested', 'human_review'])

export interface SkillDepth {
  skillId: string
  depth: number
  /** Highest difficulty_cleared reached — what the UI displays as a level. */
  bestLevel: number
  /** Distinct artifacts contributing, for "React · Strong · 6 projects". */
  artifactCount: number
  /** True when any contributing evidence is proof-it-runs rather than a
   *  bare repo link. Feeds the confidence figure in §7. */
  hasVerifiedEvidence: boolean
}

export interface EvidenceRow {
  skill_id: string
  base: number
  tier_weight: number | null
  difficulty_cleared: number
  artifact_id: string | null
  verification_method: string | null
  created_at: string
}

export function depthFromEvidenceRows(rows: EvidenceRow[], now: Date = new Date()): Map<string, SkillDepth> {
  const bySkill = new Map<string, EvidenceRow[]>()
  for (const row of rows) {
    if (!bySkill.has(row.skill_id)) bySkill.set(row.skill_id, [])
    bySkill.get(row.skill_id)!.push(row)
  }

  const result = new Map<string, SkillDepth>()
  for (const [skillId, skillRows] of Array.from(bySkill.entries())) {
    // tier_weight is a generated column (base × independence × paid);
    // fall back to base if it's somehow null.
    const scored = skillRows.map((r) => ({
      row: r,
      weighted: (r.tier_weight ?? r.base) * r.difficulty_cleared,
    }))

    // Sorted descending, so rank decay hits the weakest evidence hardest
    // rather than whatever happened to be scanned last.
    scored.sort((a, b) => b.weighted - a.weighted)

    let depth = 0
    scored.forEach((s, k) => {
      depth += s.weighted * Math.pow(RANK_DECAY, k) * recencyMultiplier(s.row.created_at, now)
    })

    result.set(skillId, {
      skillId,
      depth,
      bestLevel: Math.max(...skillRows.map((r) => r.difficulty_cleared)),
      artifactCount: new Set(skillRows.map((r) => r.artifact_id).filter(Boolean)).size || skillRows.length,
      hasVerifiedEvidence: skillRows.some((r) => r.verification_method && VERIFIED_METHODS.has(r.verification_method)),
    })
  }
  return result
}

const EVIDENCE_COLUMNS = 'skill_id, base, tier_weight, difficulty_cleared, artifact_id, verification_method, created_at'

/** Depth for one student across every skill they have evidence in. */
export async function getStudentDepth(
  supabase: SupabaseClient,
  studentId: string,
): Promise<Map<string, SkillDepth>> {
  const { data, error } = await supabase
    .from('current_skill_evidence')
    .select(EVIDENCE_COLUMNS)
    .eq('student_id', studentId)
  if (error) throw error
  return depthFromEvidenceRows((data ?? []) as EvidenceRow[])
}

/** Same, for many students at once — one query, grouped by student. */
export async function getDepthForStudents(
  supabase: SupabaseClient,
  studentIds: string[],
): Promise<Map<string, Map<string, SkillDepth>>> {
  const out = new Map<string, Map<string, SkillDepth>>()
  if (studentIds.length === 0) return out

  const { data, error } = await supabase
    .from('current_skill_evidence')
    .select(`student_id, ${EVIDENCE_COLUMNS}`)
    .in('student_id', studentIds)
  if (error) throw error

  const byStudent = new Map<string, EvidenceRow[]>()
  for (const row of (data ?? []) as (EvidenceRow & { student_id: string })[]) {
    if (!byStudent.has(row.student_id)) byStudent.set(row.student_id, [])
    byStudent.get(row.student_id)!.push(row)
  }
  for (const studentId of studentIds) {
    out.set(studentId, depthFromEvidenceRows(byStudent.get(studentId) ?? []))
  }
  return out
}
