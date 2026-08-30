// Forces a calibration check across every skill.
//
// Normally the absolute-bands → percentile switch happens lazily: it's
// checked inside computeDifficultyLevel, so it fires the next time
// anyone scans a repo containing that skill. That's fine while scans are
// frequent, but it means a skill can sit past the 30-student threshold
// indefinitely if nobody happens to scan it — the students already
// evidenced in it keep carrying levels computed under the old method.
//
// This walks every skill and applies the same check deliberately. Safe
// to run repeatedly: skills already switched are skipped, and the switch
// itself writes correction rows rather than mutating anything.
//
// Usage:
//   node --env-file=.env.local scripts/recompute-calibration.mjs
//   node --env-file=.env.local scripts/recompute-calibration.mjs --dry-run

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DRY_RUN = process.argv.includes('--dry-run')

// Must match BOOTSTRAP_THRESHOLD in src/lib/skills/levels.ts. Duplicated
// rather than imported because this runs under plain node with no
// TypeScript or path-alias resolution — keep the two in sync.
const BOOTSTRAP_THRESHOLD = 30

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function tercileOf(value, sorted) {
  if (sorted.length === 0) return 1
  const below = sorted.filter((v) => v < value).length
  const percentile = below / sorted.length
  if (percentile < 1 / 3) return 1
  if (percentile < 2 / 3) return 2
  return 3
}

async function main() {
  const { data: calibrations, error: calErr } = await admin
    .from('skill_calibration')
    .select('skill_id, method')
  if (calErr) throw calErr

  const alreadyPercentile = new Set(
    (calibrations ?? []).filter((c) => c.method === 'percentile').map((c) => c.skill_id),
  )

  const { data: evidence, error: evErr } = await admin
    .from('current_skill_evidence')
    .select('id, student_id, skill_id, artifact_id, engagement_id, rater_id, base, independence, paid, raw_composite, difficulty_cleared, verification_method, source_agreement, comparative_anchor')
  if (evErr) throw evErr

  const bySkill = new Map()
  for (const row of evidence ?? []) {
    if (!bySkill.has(row.skill_id)) bySkill.set(row.skill_id, [])
    bySkill.get(row.skill_id).push(row)
  }

  let switched = 0
  let corrections = 0

  for (const [skillId, rows] of bySkill) {
    if (alreadyPercentile.has(skillId)) continue

    const distinctStudents = new Set(rows.map((r) => r.student_id)).size
    if (distinctStudents < BOOTSTRAP_THRESHOLD) continue

    const composites = rows
      .map((r) => r.raw_composite)
      .filter((v) => v != null)
      .sort((a, b) => a - b)

    const changes = rows
      .filter((r) => r.raw_composite != null)
      .map((r) => ({ row: r, newLevel: tercileOf(r.raw_composite, composites) }))
      .filter(({ row, newLevel }) => newLevel !== row.difficulty_cleared)

    console.log(
      `${skillId}: ${distinctStudents} students, ${rows.length} rows → ${changes.length} level change(s)`,
    )
    switched++
    corrections += changes.length

    if (DRY_RUN) continue

    const { error: switchErr } = await admin
      .from('skill_calibration')
      .update({
        method: 'percentile',
        student_count_at_switch: distinctStudents,
        switched_at: new Date().toISOString(),
      })
      .eq('skill_id', skillId)
    if (switchErr) throw switchErr

    for (const { row, newLevel } of changes) {
      // A correction row, never an UPDATE — skill_evidence's append-only
      // trigger rejects updates outright, and the whole point is that the
      // old value stays on the record.
      const { error: insertErr } = await admin.from('skill_evidence').insert({
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

  if (switched === 0) {
    console.log(`\nNothing to switch — no skill has reached ${BOOTSTRAP_THRESHOLD} distinct students yet.`)
  } else {
    console.log(
      `\n${DRY_RUN ? '[dry run] would switch' : 'Switched'} ${switched} skill(s) to percentile, ` +
        `${DRY_RUN ? 'writing' : 'wrote'} ${corrections} correction row(s).`,
    )
  }
}

main().catch((err) => {
  console.error('\nRecompute failed:', err.message ?? err)
  process.exit(1)
})
