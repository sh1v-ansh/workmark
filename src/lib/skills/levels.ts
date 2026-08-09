// Turns a raw complexity composite (src/lib/github/complexity.ts) into a
// 1-5 difficulty_cleared value. Below 30 students with evidence in a
// skill: absolute bands. At/above 30: percentile-within-skill, switching
// via skill_calibration and recomputing existing evidence as correction
// rows (§5, Phase 0's append-only design).
//
// Every value this module produces is 1-3 (Familiar/Practiced/Strong) —
// there's no attestation anywhere in MVP, so every skill_evidence row the
// scan pipeline writes is self-evidenced and capped at Strong (§3). Levels
// 4-5 stay unreachable until Tier 1+ attestation exists; this module isn't
// what enforces that cap (evidence.ts is), it just never has a reason to
// return above 3 given only these two calibration methods exist yet.

import type { SupabaseClient } from '@supabase/supabase-js'

const BOOTSTRAP_THRESHOLD = 30

export interface LevelResult {
  difficultyCleared: 1 | 2 | 3
  method: 'absolute_bands' | 'percentile'
}

export async function computeDifficultyLevel(
  supabase: SupabaseClient,
  skillId: string,
  rawComposite: number,
): Promise<LevelResult> {
  let method = await getCalibrationMethod(supabase, skillId)

  if (method === 'absolute_bands') {
    const distinctCount = await countDistinctStudents(supabase, skillId)
    if (distinctCount >= BOOTSTRAP_THRESHOLD) {
      await switchToPercentileAndRecompute(supabase, skillId, distinctCount)
      method = 'percentile'
    }
  }

  if (method === 'percentile') {
    return { difficultyCleared: await percentileLevel(supabase, skillId, rawComposite), method: 'percentile' }
  }
  return { difficultyCleared: absoluteBandLevel(rawComposite), method: 'absolute_bands' }
}

async function getCalibrationMethod(supabase: SupabaseClient, skillId: string): Promise<'absolute_bands' | 'percentile'> {
  const { data } = await supabase.from('skill_calibration').select('method').eq('skill_id', skillId).maybeSingle()
  if (data) return data.method
  const { error } = await supabase.from('skill_calibration').insert({ skill_id: skillId, method: 'absolute_bands' })
  // A concurrent first-insert for the same skill racing this one is benign
  // (skill_id is the primary key) — not a reason to fail.
  if (error && error.code !== '23505') throw error
  return 'absolute_bands'
}

async function countDistinctStudents(supabase: SupabaseClient, skillId: string): Promise<number> {
  const { data, error } = await supabase
    .from('current_skill_evidence')
    .select('student_id')
    .eq('skill_id', skillId)
  if (error) throw error
  return new Set((data ?? []).map((r) => r.student_id)).size
}

/**
 * Unvalidated starting thresholds — same honesty as the other Phase 1
 * heuristics. There's nothing to calibrate against below the bootstrap
 * threshold by definition, which is exactly why absolute bands exist as a
 * fallback rather than trying to force percentile ranking on too small a
 * population.
 */
function absoluteBandLevel(composite: number): 1 | 2 | 3 {
  if (composite < 20) return 1
  if (composite < 40) return 2
  return 3
}

async function percentileLevel(supabase: SupabaseClient, skillId: string, composite: number): Promise<1 | 2 | 3> {
  const values = await currentComposites(supabase, skillId)
  if (values.length === 0) return absoluteBandLevel(composite) // defensive — shouldn't happen once in percentile mode
  return tercileOf(composite, values)
}

async function currentComposites(supabase: SupabaseClient, skillId: string): Promise<number[]> {
  const { data, error } = await supabase
    .from('current_skill_evidence')
    .select('raw_composite')
    .eq('skill_id', skillId)
    .not('raw_composite', 'is', null)
  if (error) throw error
  return (data ?? []).map((r) => r.raw_composite as number).sort((a, b) => a - b)
}

function tercileOf(composite: number, sortedValues: number[]): 1 | 2 | 3 {
  const rank = sortedValues.filter((v) => v <= composite).length
  const percentile = rank / sortedValues.length
  if (percentile < 1 / 3) return 1
  if (percentile < 2 / 3) return 2
  return 3
}

/**
 * The one-time switch, and the recompute it triggers. Every CURRENT
 * evidence row for this skill gets re-leveled against the now-percentile
 * distribution; where the level actually changes, a correction row is
 * inserted (never an UPDATE — skill_evidence's append-only trigger would
 * reject it anyway). Rows with no stored raw_composite (shouldn't occur
 * for anything this pipeline wrote, but could for older/manually-inserted
 * data) are left alone — there's nothing to recompute them from.
 *
 * Not fully race-safe under concurrent scans crossing the threshold at
 * once — at MVP's real scale (a handful of users) a redundant duplicate
 * correction pass is wasteful, not corrupting, and not worth the added
 * complexity of proper locking yet.
 */
async function switchToPercentileAndRecompute(supabase: SupabaseClient, skillId: string, distinctCount: number): Promise<void> {
  const { error: calErr } = await supabase
    .from('skill_calibration')
    .update({ method: 'percentile', student_count_at_switch: distinctCount, switched_at: new Date().toISOString() })
    .eq('skill_id', skillId)
  if (calErr) throw calErr

  const { data: rows, error: rowsErr } = await supabase
    .from('current_skill_evidence')
    .select('*')
    .eq('skill_id', skillId)
  if (rowsErr) throw rowsErr
  if (!rows || rows.length === 0) return

  const composites = rows.map((r) => r.raw_composite).filter((v: number | null): v is number => v != null).sort((a: number, b: number) => a - b)

  for (const row of rows) {
    if (row.raw_composite == null) continue
    const newLevel = tercileOf(row.raw_composite, composites)
    if (newLevel === row.difficulty_cleared) continue

    const { error: insertErr } = await supabase.from('skill_evidence').insert({
      student_id: row.student_id,
      skill_id: row.skill_id,
      artifact_id: row.artifact_id,
      engagement_id: row.engagement_id,
      rater_id: row.rater_id,
      base: row.base,
      independence: row.independence,
      paid: row.paid,
      raw_composite: row.raw_composite,
      difficulty_cleared: newLevel,
      verification_method: row.verification_method,
      source_agreement: row.source_agreement,
      comparative_anchor: row.comparative_anchor,
      corrects_evidence_id: row.id,
    })
    if (insertErr) throw insertErr
  }
}
