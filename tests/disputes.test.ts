import { describe, it, expect } from 'vitest'
import {
  DISPUTE_CATEGORIES, categoryMeta, isMachineCheckable, isResolved,
  daysRemaining, reinvestigationOutcome, STATUS_LABEL,
  type DisputeCategory, type DisputeStatus,
} from '@/lib/fcra/disputes'

const ALL_STATUSES: DisputeStatus[] = [
  'open', 'reinvestigating', 'resolved_corrected',
  'resolved_retracted', 'resolved_verified', 'resolved_manual',
]

describe('dispute categories', () => {
  it('marks code-derived categories machine-checkable and fact-based ones not', () => {
    // The distinction is the whole design: evidence derived from code can
    // be reinvestigated by re-running the derivation. A claim about
    // whether a past disclosure was authorized cannot.
    expect(isMachineCheckable('inaccurate_level')).toBe(true)
    expect(isMachineCheckable('skill_not_demonstrated')).toBe(true)
    expect(isMachineCheckable('not_my_work')).toBe(true)
    expect(isMachineCheckable('wrong_attribution')).toBe(true)
    expect(isMachineCheckable('disclosure_unauthorized')).toBe(false)
    expect(isMachineCheckable('other')).toBe(false)
  })

  it('gives every category a label and help text — no bare enum leaks to the UI', () => {
    for (const c of DISPUTE_CATEGORIES) {
      expect(c.label.length).toBeGreaterThan(0)
      expect(c.help.length).toBeGreaterThan(0)
    }
  })

  it('only requires an evidence row for categories that are about one', () => {
    expect(categoryMeta('inaccurate_level')!.needsEvidence).toBe(true)
    expect(categoryMeta('disclosure_unauthorized')!.needsEvidence).toBe(false)
    expect(categoryMeta('other')!.needsEvidence).toBe(false)
  })

  it('returns null for an unknown category rather than throwing', () => {
    expect(categoryMeta('nonsense' as DisputeCategory)).toBeNull()
    expect(isMachineCheckable('nonsense' as DisputeCategory)).toBe(false)
  })

  it('labels every status', () => {
    for (const s of ALL_STATUSES) expect(STATUS_LABEL[s].length).toBeGreaterThan(0)
  })

  it('treats exactly the resolved_* statuses as resolved', () => {
    expect(isResolved('open')).toBe(false)
    expect(isResolved('reinvestigating')).toBe(false)
    for (const s of ALL_STATUSES.filter((x) => x.startsWith('resolved_'))) {
      expect(isResolved(s)).toBe(true)
    }
  })
})

describe('daysRemaining — the §611 clock', () => {
  const now = new Date('2026-03-01T00:00:00Z')

  it('counts days left before the deadline', () => {
    expect(daysRemaining('2026-03-31T00:00:00Z', now)).toBe(30)
    expect(daysRemaining('2026-03-02T00:00:00Z', now)).toBe(1)
  })

  it('goes negative when overdue rather than clamping — an overdue dispute should look overdue', () => {
    expect(daysRemaining('2026-02-25T00:00:00Z', now)).toBe(-4)
  })

  it('is 0 on the deadline itself', () => {
    expect(daysRemaining('2026-03-01T00:00:00Z', now)).toBe(0)
  })
})

describe('reinvestigationOutcome', () => {
  const base = {
    category: 'inaccurate_level' as DisputeCategory,
    hasAttributedCommits: true,
    skillStillDetected: true,
    recomputedLevel: 3,
    originalLevel: 3,
  }

  it('verifies when the rescan reproduces the original level', () => {
    const r = reinvestigationOutcome(base)
    expect(r.status).toBe('resolved_verified')
  })

  it('corrects when the rescan produces a different level', () => {
    const r = reinvestigationOutcome({ ...base, recomputedLevel: 2 })
    expect(r.status).toBe('resolved_corrected')
    // The note has to name both values — "we changed it" without saying
    // from what to what is not a reinvestigation result.
    expect(r.note).toContain('2')
    expect(r.note).toContain('3')
  })

  it('retracts when no commits are attributed to the student', () => {
    const r = reinvestigationOutcome({ ...base, hasAttributedCommits: false })
    expect(r.status).toBe('resolved_retracted')
  })

  it('retracts on attribution failure regardless of category or recomputed level', () => {
    // If the commits aren't theirs, nothing else about the row matters.
    for (const category of ['inaccurate_level', 'not_my_work', 'other'] as DisputeCategory[]) {
      const r = reinvestigationOutcome({ ...base, category, hasAttributedCommits: false, recomputedLevel: 5 })
      expect(r.status).toBe('resolved_retracted')
    }
  })

  it('retracts when the skill is no longer detected in the repo', () => {
    const r = reinvestigationOutcome({ ...base, skillStillDetected: false })
    expect(r.status).toBe('resolved_retracted')
  })

  it('checks attribution before skill detection — the stronger finding wins', () => {
    const r = reinvestigationOutcome({ ...base, hasAttributedCommits: false, skillStillDetected: false })
    expect(r.status).toBe('resolved_retracted')
    expect(r.note).toContain('no commits attributed')
  })

  it('routes to a human when the level could not be recomputed', () => {
    const r = reinvestigationOutcome({ ...base, recomputedLevel: null })
    expect(r.status).toBe('resolved_manual')
  })

  it('never leaves a dispute unresolved — every input combination reaches a terminal status', () => {
    for (const hasAttributedCommits of [true, false]) {
      for (const skillStillDetected of [true, false]) {
        for (const recomputedLevel of [null, 1, 3, 5]) {
          const r = reinvestigationOutcome({ ...base, hasAttributedCommits, skillStillDetected, recomputedLevel })
          expect(isResolved(r.status)).toBe(true)
          expect(r.note.length).toBeGreaterThan(0)
        }
      }
    }
  })
})
