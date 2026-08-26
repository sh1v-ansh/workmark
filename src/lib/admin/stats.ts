// The numbers an admin actually needs, and the reports nothing was reading.
//
// Three of these exist because data was being collected and never looked at:
// every fit tier ever shown to a student is recorded for the fairness audit
// and nothing had read it; the calibration table records when a skill
// switched from fixed bands to percentiles and nothing showed it; and the
// staff action log was written but never displayed.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface Overview {
  students: number
  faculty: number
  unverifiedFaculty: number
  openListings: number
  liveEngagements: number
  evidenceRows: number
  scansLast7Days: number
  failedScans: number
  overdueDisputes: number
}

/** Row count only — `head: true` sends no rows back. */
const HEAD = { count: 'exact' as const, head: true }

export async function loadOverview(admin: SupabaseClient): Promise<Overview> {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const now = new Date().toISOString()
  const t = (table: string) => admin.from(table).select('id', HEAD)

  const results = await Promise.all([
    t('students'),
    t('accounts').contains('roles', ['faculty']),
    t('accounts').contains('roles', ['faculty']).is('faculty_verified_at', null),
    t('listings').eq('status', 'open'),
    t('engagements').in('stage', ['accepted', 'in_progress', 'submitted']),
    t('skill_evidence'),
    t('jobs').gte('created_at', weekAgo),
    t('jobs').eq('status', 'failed'),
    t('disputes').in('status', ['open', 'reinvestigating']).lt('due_at', now),
  ])

  const [
    students, faculty, unverifiedFaculty, openListings, liveEngagements,
    evidenceRows, scansLast7Days, failedScans, overdueDisputes,
  ] = results.map((r) => r.count ?? 0)

  return {
    students, faculty, unverifiedFaculty, openListings, liveEngagements,
    evidenceRows, scansLast7Days, failedScans, overdueDisputes,
  }
}

// ─── Fairness ────────────────────────────────────────────────────────────────

export interface FairnessRow {
  tier: string
  shown: number
  applied: number
  /** Of the students shown this tier, how many went on to apply. */
  applyRate: number
}

/**
 * What the fit tiers actually did.
 *
 * Every tier shown to every student has been recorded since the beginning
 * and never read once. The question this is meant to answer is whether the
 * tier is discouraging people who would have been fine — if almost nobody
 * shown "reach" ever applies, the label isn't informing a decision, it's
 * making it for them.
 *
 * This is the deliberately simple version: distribution and follow-through.
 * A real disparate-impact analysis needs demographic data the platform
 * doesn't collect and shouldn't start collecting casually — what this can
 * honestly show is whether the filter is doing something extreme.
 */
export async function loadFairness(admin: SupabaseClient): Promise<{
  rows: FairnessRow[]
  totalShown: number
  missingSkillsTop: { skill: string; count: number }[]
}> {
  const { data: impressions } = await admin
    .from('fit_tier_impressions')
    .select('tier, student_id, listing_id, missing_skills')
    .limit(5000)

  const { data: applications } = await admin
    .from('applications')
    .select('student_id, listing_id, fit_tier_at_apply')

  const applied = new Set((applications ?? []).map((a) => `${a.student_id}:${a.listing_id}`))

  const byTier = new Map<string, { shown: number; applied: number }>()
  const missing = new Map<string, number>()

  for (const i of impressions ?? []) {
    const row = byTier.get(i.tier) ?? { shown: 0, applied: 0 }
    row.shown++
    if (applied.has(`${i.student_id}:${i.listing_id}`)) row.applied++
    byTier.set(i.tier, row)

    for (const s of (i.missing_skills ?? []) as string[]) {
      missing.set(s, (missing.get(s) ?? 0) + 1)
    }
  }

  const ORDER = ['strong_fit', 'competitive', 'reach', 'not_yet']
  const rows: FairnessRow[] = ORDER
    .filter((t) => byTier.has(t))
    .map((tier) => {
      const r = byTier.get(tier)!
      return { tier, shown: r.shown, applied: r.applied, applyRate: r.shown > 0 ? r.applied / r.shown : 0 }
    })

  const missingSkillsTop = Array.from(missing.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([skill, count]) => ({ skill, count }))

  return {
    rows,
    totalShown: (impressions ?? []).length,
    missingSkillsTop,
  }
}

// ─── Calibration ─────────────────────────────────────────────────────────────

export interface CalibrationRow {
  skillId: string
  skillName: string
  method: string
  studentCount: number | null
  switchedAt: string | null
  evidenceCount: number
}

/**
 * Which skills are scored against real peers, and which are still on fixed
 * bands because too few people have them yet.
 *
 * Worth showing because it explains something students otherwise experience
 * as unexplained: a level can move without them doing any new work, when a
 * skill crosses the threshold and switches to percentile scoring.
 */
export async function loadCalibration(admin: SupabaseClient): Promise<CalibrationRow[]> {
  const [{ data: calibration }, { data: evidence }] = await Promise.all([
    admin.from('skill_calibration').select('skill_id, method, student_count_at_switch, switched_at'),
    admin.from('current_skill_evidence').select('skill_id, student_id'),
  ])

  const counts = new Map<string, Set<string>>()
  for (const e of evidence ?? []) {
    if (!counts.has(e.skill_id)) counts.set(e.skill_id, new Set())
    counts.get(e.skill_id)!.add(e.student_id)
  }

  const skillIds = Array.from(new Set([
    ...(calibration ?? []).map((c) => c.skill_id),
    ...Array.from(counts.keys()),
  ]))
  if (skillIds.length === 0) return []

  const { data: skills } = await admin.from('skills').select('id, canonical_name').in('id', skillIds)
  const nameById = new Map((skills ?? []).map((s) => [s.id, s.canonical_name]))
  const calById = new Map((calibration ?? []).map((c) => [c.skill_id, c]))

  return skillIds
    .map((id) => {
      const c = calById.get(id)
      return {
        skillId: id,
        skillName: nameById.get(id) ?? id,
        method: c?.method ?? 'absolute_bands',
        studentCount: c?.student_count_at_switch ?? null,
        switchedAt: c?.switched_at ?? null,
        evidenceCount: counts.get(id)?.size ?? 0,
      }
    })
    .sort((a, b) => b.evidenceCount - a.evidenceCount)
}
