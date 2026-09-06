import type { SupabaseClient } from '@supabase/supabase-js'
import { generateBrief } from '@/lib/agents/brief'
import { pickRecommendationTargets, type Target } from '@/lib/briefs/targets'

/**
 * The nightly recommendation run.
 *
 * The expensive decision here is not which skills to pick — that is
 * arithmetic, in targets.ts — it is who to run at all. "Every student, every
 * night" is one Anthropic call per student per day forever, including for
 * accounts that have not been opened since March, and the bill for that
 * grows with signups rather than with use.
 *
 * So it tops up rather than refreshes. A student is skipped unless they are
 * below TARGET_OPEN unstarted recommendations, which means the steady state
 * for a dormant account is zero calls a night, and the only accounts costing
 * anything are the ones actually starting the projects we suggest. Nobody
 * needs a fourth idea while three are sitting untouched.
 */

/** How many unstarted recommendations a student should have waiting. */
export const TARGET_OPEN = 3

/** Most students one run will touch. A safety rail, not a business rule:
 *  it caps what a single bad night can spend, and the next run picks up
 *  whoever was missed. */
export const MAX_STUDENTS_PER_RUN = 120

export interface RunSummary {
  considered: number
  skipped: number
  generated: number
  failed: number
}

/**
 * One student's worth of work. Exported so a single student can be topped
 * up on demand — from an admin page, or the first time someone connects
 * GitHub — without waiting for the small hours.
 */
export async function recommendForStudent(
  supabase: SupabaseClient,
  studentId: string,
): Promise<{ generated: number; failed: number }> {
  // What they already have waiting. If they are at target, this student
  // costs nothing tonight.
  const { data: open } = await supabase
    .from('project_briefs')
    .select('target_skill_id')
    .eq('student_id', studentId)
    .eq('source', 'recommended')
    .is('started_at', null)

  const openCount = open?.length ?? 0
  if (openCount >= TARGET_OPEN) return { generated: 0, failed: 0 }

  const [{ data: evidenceRows }, { data: demandRows }] = await Promise.all([
    supabase
      .from('current_skill_evidence')
      .select('skill_id, difficulty_cleared, artifact_id')
      .eq('student_id', studentId),
    supabase
      .from('listing_requirements')
      .select('skill_id, listings!inner(status)')
      .eq('listings.status', 'open'),
  ])

  // Nothing to personalise from. A brief built on no evidence at all is a
  // generic project with this student's name on it, which is worse than no
  // recommendation — it teaches them the feature is not worth reading.
  if (!evidenceRows || evidenceRows.length === 0) return { generated: 0, failed: 0 }

  const bySkill = new Map<string, { level: number; artifacts: Set<string> }>()
  for (const row of evidenceRows) {
    const entry = bySkill.get(row.skill_id) ?? { level: 0, artifacts: new Set<string>() }
    entry.level = Math.max(entry.level, row.difficulty_cleared)
    if (row.artifact_id) entry.artifacts.add(row.artifact_id)
    bySkill.set(row.skill_id, entry)
  }
  const evidence = Array.from(bySkill.entries()).map(([skillId, e]) => ({
    skillId,
    level: e.level,
    projectCount: e.artifacts.size,
  }))

  const demand = new Map<string, number>()
  for (const row of demandRows ?? []) {
    demand.set(row.skill_id, (demand.get(row.skill_id) ?? 0) + 1)
  }

  // The taxonomy, for finding neighbours. Only the families the student is
  // actually in — pulling the whole skill table to answer "what sits next
  // to Postgres" would be a few thousand rows to use four of them.
  const { data: ownSkills } = await supabase
    .from('skills')
    .select('id, parent_id')
    .in('id', evidence.map((e) => e.skillId))
    .is('deprecated_at', null)

  const parentBySkill = new Map<string, string | null>(
    (ownSkills ?? []).map((s) => [s.id, s.parent_id]),
  )
  const parentIds = Array.from(
    new Set((ownSkills ?? []).map((s) => s.parent_id).filter((p): p is string => !!p)),
  )
  const { data: siblingRows } = parentIds.length
    ? await supabase
        .from('skills')
        .select('id, parent_id')
        .in('parent_id', parentIds)
        .is('deprecated_at', null)
    : { data: [] as { id: string; parent_id: string | null }[] }

  const childrenByParent = new Map<string, string[]>()
  for (const row of siblingRows ?? []) {
    if (!row.parent_id) continue
    const list = childrenByParent.get(row.parent_id) ?? []
    list.push(row.id)
    childrenByParent.set(row.parent_id, list)
  }

  const targets = pickRecommendationTargets(
    {
      evidence,
      demand,
      parentBySkill,
      childrenByParent,
      // Never suggest a skill they already have an unstarted idea for.
      exclude: new Set((open ?? []).map((b) => b.target_skill_id).filter((id): id is string => !!id)),
    },
    TARGET_OPEN - openCount,
  )

  let generated = 0
  let failed = 0

  // One at a time on purpose. These are Anthropic calls; firing three in
  // parallel per student across a hundred students is a thundering herd
  // against a rate limit, and nothing here is waiting on the result.
  for (const target of targets) {
    try {
      const ok = await writeRecommendation(supabase, studentId, target)
      if (ok) generated++
      else failed++
    } catch (err) {
      console.error('[recommend] brief failed', { studentId, target, err })
      failed++
    }
  }

  return { generated, failed }
}

async function writeRecommendation(
  supabase: SupabaseClient,
  studentId: string,
  target: Target,
): Promise<boolean> {
  const brief = await generateBrief(supabase, studentId, target.skillId, {
    // Deliberately not passing skillLevel or careerTrack. Those are things
    // the student chose when they asked for a brief themselves; guessing
    // them on their behalf and writing the result into their record is a
    // different act from offering a project. The agent still reads their
    // whole evidence list, which is the part that makes it personal.
    targetRole: null,
    skillLevel: null,
    careerTrack: null,
  })
  if (!brief) return false

  const { error } = await supabase.from('project_briefs').insert({
    student_id: studentId,
    target_skill_id: brief.targetSkillId,
    // Same shape every other brief is stored in: title, blank line, body.
    brief_text: `${brief.title}\n\n${brief.briefText}`,
    difficulty: brief.difficulty,
    source: 'recommended',
    recommendation_reason: target.reason,
  })
  if (error) {
    console.error('[recommend] insert failed', { studentId, error })
    return false
  }
  return true
}

/**
 * Everyone worth running tonight, neediest first.
 *
 * The first version of this took `.limit(120)` straight off
 * github_connections and asked each of them in turn whether they needed
 * anything. Two things wrong with that, and the second one is not a
 * performance note.
 *
 * It did 120 round trips a night to discover 120 no-ops once everyone was
 * topped up — the limit was on students rather than on work.
 *
 * And past 120 connected students it starved the rest permanently. An
 * unordered limit returns whichever rows Postgres finds first, which in
 * practice is the same rows every night, so student 121 would never have
 * received a recommendation at all. Not "eventually" — never.
 *
 * So the shortlist is built first, in two small queries, and the limit is
 * applied to people who actually need something. Zero-recommendation
 * students come first, then whoever has waited longest, so a busy night
 * that hits the cap resumes with the same people tomorrow rather than
 * re-serving whoever happens to sort first.
 */
export async function runRecommendationSweep(supabase: SupabaseClient): Promise<RunSummary> {
  const [{ data: connected }, { data: openBriefs }] = await Promise.all([
    supabase.from('github_connections').select('student_id'),
    // Covered by project_briefs_open_recommendations_idx.
    supabase
      .from('project_briefs')
      .select('student_id, issued_at')
      .eq('source', 'recommended')
      .is('started_at', null),
  ])

  const summary: RunSummary = { considered: 0, skipped: 0, generated: 0, failed: 0 }
  if (!connected || connected.length === 0) return summary

  const openCount = new Map<string, number>()
  const newestOpen = new Map<string, string>()
  for (const b of openBriefs ?? []) {
    openCount.set(b.student_id, (openCount.get(b.student_id) ?? 0) + 1)
    const seen = newestOpen.get(b.student_id)
    if (!seen || b.issued_at > seen) newestOpen.set(b.student_id, b.issued_at)
  }

  const due = connected
    .map((c) => ({
      studentId: c.student_id,
      have: openCount.get(c.student_id) ?? 0,
      // Never recommended to sorts before everyone who has been.
      waitedSince: newestOpen.get(c.student_id) ?? '',
    }))
    .filter((c) => c.have < TARGET_OPEN)
    .sort((a, b) => a.have - b.have || a.waitedSince.localeCompare(b.waitedSince))
    .slice(0, MAX_STUDENTS_PER_RUN)

  for (const student of due) {
    summary.considered++
    const { generated, failed } = await recommendForStudent(supabase, student.studentId)
    if (generated === 0 && failed === 0) summary.skipped++
    summary.generated += generated
    summary.failed += failed
  }

  return summary
}
