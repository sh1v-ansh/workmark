// Switching a skill from fixed difficulty bands to real percentiles.
//
// A skill starts scored against absolute bands because there's nobody to
// compare against. Once enough students have evidence in it, the honest
// scoring is "where does this sit among people who actually have this
// skill" — so it switches, and existing levels are corrected to match.
//
// This lived only in a script that somebody had to remember to run. A skill
// could sit past the threshold indefinitely, scored against bands that no
// longer described anyone, and nothing would say so.
//
// Corrections are written as NEW evidence rows pointing at the ones they
// supersede, never as updates. That's not ceremony: a level moving without
// the student doing any new work is exactly the change they'd dispute, and
// the switch event has to stay reconstructible afterwards.

import type { SupabaseClient } from '@supabase/supabase-js'

/** Students with a skill before it's worth ranking them against each other. */
export const BOOTSTRAP_THRESHOLD = 30

export interface CalibrationResult {
  skillsSwitched: string[]
  correctionsWritten: number
  dryRun: boolean
}

/** Which third of the distribution a score falls in. */
export function tercileOf(value: number, sorted: number[]): number {
  if (sorted.length === 0) return 1
  const below = sorted.filter((v) => v < value).length
  const percentile = below / sorted.length
  if (percentile < 1 / 3) return 1
  if (percentile < 2 / 3) return 2
  return 3
}

export async function recomputeCalibration(
  admin: SupabaseClient,
  options: { dryRun?: boolean } = {},
): Promise<CalibrationResult> {
  const dryRun = options.dryRun ?? false

  const [{ data: calibrations }, { data: evidence }] = await Promise.all([
    admin.from('skill_calibration').select('skill_id, method'),
    admin
      .from('current_skill_evidence')
      .select('id, student_id, skill_id, artifact_id, engagement_id, base, raw_composite, difficulty_cleared, verification_method'),
  ])

  const alreadyPercentile = new Set(
    (calibrations ?? []).filter((c) => c.method === 'percentile').map((c) => c.skill_id),
  )

  const bySkill = new Map<string, NonNullable<typeof evidence>>()
  for (const row of evidence ?? []) {
    if (!bySkill.has(row.skill_id)) bySkill.set(row.skill_id, [])
    bySkill.get(row.skill_id)!.push(row)
  }

  const skillsSwitched: string[] = []
  let correctionsWritten = 0

  for (const [skillId, rows] of Array.from(bySkill.entries())) {
    if (alreadyPercentile.has(skillId)) continue

    const distinctStudents = new Set(rows.map((r) => r.student_id)).size
    if (distinctStudents < BOOTSTRAP_THRESHOLD) continue

    const composites = rows
      .map((r) => r.raw_composite as number | null)
      .filter((v): v is number => v != null)
      .sort((a, b) => a - b)

    const changes = rows
      .filter((r) => r.raw_composite != null)
      .map((r) => ({ row: r, newLevel: tercileOf(r.raw_composite as number, composites) }))
      .filter(({ row, newLevel }) => newLevel !== row.difficulty_cleared)

    skillsSwitched.push(skillId)
    correctionsWritten += changes.length
    if (dryRun) continue

    const { error: switchErr } = await admin
      .from('skill_calibration')
      .upsert({
        skill_id: skillId,
        method: 'percentile',
        student_count_at_switch: distinctStudents,
        switched_at: new Date().toISOString(),
      }, { onConflict: 'skill_id' })
    if (switchErr) {
      console.error(`[calibration] could not switch ${skillId}:`, switchErr)
      continue
    }

    if (changes.length === 0) continue

    // New rows correcting the old ones, never updates. skill_evidence is
    // append-only by trigger, and a file disclosure has to be able to show
    // what the record said before.
    const corrections = changes.map(({ row, newLevel }) => ({
      student_id: row.student_id,
      skill_id: row.skill_id,
      artifact_id: row.artifact_id,
      engagement_id: row.engagement_id,
      base: row.base,
      raw_composite: row.raw_composite,
      difficulty_cleared: newLevel,
      verification_method: row.verification_method,
      corrects_evidence_id: row.id,
      source_agreement: 1,
    }))

    const { error: insertErr } = await admin.from('skill_evidence').insert(corrections)
    if (insertErr) console.error(`[calibration] corrections failed for ${skillId}:`, insertErr)
  }

  return { skillsSwitched, correctionsWritten, dryRun }
}
