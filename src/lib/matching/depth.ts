// Per-skill depth: how much demonstrated evidence a student has in one
// skill, reduced to a single comparable number.
//
// Reads current_skill_evidence (the view, so superseded correction rows
// are already excluded) — never skill_priors. A prior means "this
// appeared in a repo you were granted access to"; evidence means "you
// actually committed to a repo demonstrating it". Only the latter is a
// claim about the student.
//
// The formula is deliberately simple and explainable, because a student
// is entitled to an answer to "why am I ranked below someone else" that
// doesn't require reading a model:
//
//   depth = bestLevel × bestTierWeight × (1 + corroboration)
//
//   bestLevel       the highest difficulty_cleared reached (1-5). One
//                   genuinely hard project says more than five trivial
//                   ones, so this is max, not mean.
//   bestTierWeight  0.4 solo repo / 0.5 multi-contributor today; 0.8
//                   faculty / 1.0 employer once attestation exists. Keeps
//                   self-evidenced work ranked below attested work
//                   automatically as later tiers arrive.
//   corroboration   +0.1 per additional distinct artifact beyond the
//                   first, capped at +0.3. Repetition is weak positive
//                   evidence — it shows the skill wasn't a one-off — but
//                   it must never let volume outrank depth, hence the cap.
//
// Every constant here is an unvalidated starting point, not an
// empirically derived weight. There is no outcome data to fit against
// yet; revisit once engagements have closed and there's something to
// correlate rank against.

import type { SupabaseClient } from '@supabase/supabase-js'

const CORROBORATION_PER_ARTIFACT = 0.1
const CORROBORATION_CAP = 0.3

export interface SkillDepth {
  skillId: string
  depth: number
  bestLevel: number
  artifactCount: number
}

interface EvidenceRow {
  skill_id: string
  base: number
  tier_weight: number | null
  difficulty_cleared: number
  artifact_id: string | null
}

export function depthFromEvidenceRows(rows: EvidenceRow[]): Map<string, SkillDepth> {
  const bySkill = new Map<string, EvidenceRow[]>()
  for (const row of rows) {
    if (!bySkill.has(row.skill_id)) bySkill.set(row.skill_id, [])
    bySkill.get(row.skill_id)!.push(row)
  }

  const result = new Map<string, SkillDepth>()
  for (const [skillId, skillRows] of Array.from(bySkill.entries())) {
    const bestLevel = Math.max(...skillRows.map((r) => r.difficulty_cleared))
    // tier_weight is a generated column (base × independence × paid); fall
    // back to base if a row predates it or it's somehow null.
    const bestWeight = Math.max(...skillRows.map((r) => r.tier_weight ?? r.base))
    const artifactCount = new Set(skillRows.map((r) => r.artifact_id).filter(Boolean)).size || skillRows.length
    const corroboration = Math.min(CORROBORATION_CAP, CORROBORATION_PER_ARTIFACT * (artifactCount - 1))
    result.set(skillId, {
      skillId,
      depth: bestLevel * bestWeight * (1 + corroboration),
      bestLevel,
      artifactCount,
    })
  }
  return result
}

/** Depth for one student across every skill they have evidence in. */
export async function getStudentDepth(
  supabase: SupabaseClient,
  studentId: string,
): Promise<Map<string, SkillDepth>> {
  const { data, error } = await supabase
    .from('current_skill_evidence')
    .select('skill_id, base, tier_weight, difficulty_cleared, artifact_id')
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
    .select('student_id, skill_id, base, tier_weight, difficulty_cleared, artifact_id')
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
