import { describe, it, expect } from 'vitest'
import { buildFunnel, buildCohorts, worstDrop, weekOf, type FirstSeen } from '../src/lib/admin/funnel'
import type { EventName } from '../src/lib/analytics/events'

function seen(who: string, name: EventName, at = '2026-09-22T10:00:00Z'): FirstSeen {
  return who.startsWith('s-')
    ? { studentId: who, sessionId: null, name, at }
    : { studentId: null, sessionId: who, name, at }
}

describe('buildFunnel', () => {
  it('counts people rather than events', () => {
    const rows = [
      seen('sess-1', 'signup_started'),
      seen('sess-1', 'signup_started'),
      seen('sess-2', 'signup_started'),
    ]
    expect(buildFunnel(rows)[0].reached).toBe(2)
  })

  // The step the old funnel could not see. Somebody who opened the form and
  // left leaves no row in any table, so this is the only place the
  // denominator exists.
  it('shows people who opened signup and went no further', () => {
    const rows = [
      seen('sess-1', 'signup_started'),
      seen('sess-2', 'signup_started'),
      seen('sess-3', 'signup_started'),
      seen('sess-1', 'signup_submitted'),
    ]
    const steps = buildFunnel(rows)
    expect(steps[0].reached).toBe(3)
    expect(steps[1].reached).toBe(1)
    expect(steps[1].ofPrevious).toBeCloseTo(1 / 3)
  })

  it('measures every step against the top as well as the one above', () => {
    const rows = [
      ...['a', 'b', 'c', 'd'].map((w) => seen(`sess-${w}`, 'signup_started')),
      ...['a', 'b'].map((w) => seen(`sess-${w}`, 'signup_submitted')),
      seen('s-a', 'onboarding_completed'),
    ]
    const steps = buildFunnel(rows)
    expect(steps[1].ofStart).toBeCloseTo(0.5)
    expect(steps[2].ofPrevious).toBeCloseTo(0.5)
    expect(steps[2].ofStart).toBeCloseTo(0.25)
  })

  it('has no rate for the first step, which has nothing above it', () => {
    expect(buildFunnel([seen('sess-1', 'signup_started')])[0].ofPrevious).toBeNull()
  })

  it('copes with nobody having done anything', () => {
    const steps = buildFunnel([])
    expect(steps).toHaveLength(7)
    expect(steps.every((s) => s.reached === 0)).toBe(true)
    expect(steps[0].ofStart).toBeNull()
  })
})

describe('worstDrop', () => {
  it('names the step with the biggest fall', () => {
    // Every step populated, so the only cliff is the intended one. A funnel
    // that simply stops partway has its emptiest step as the worst drop,
    // which is true and not what this is testing.
    const counts: [EventName, number][] = [
      ['signup_started', 100],
      ['signup_submitted', 90],
      ['onboarding_completed', 20], // the cliff
      ['github_connected', 19],
      ['scan_started', 18],
      ['first_evidence', 17],
      ['application_submitted', 16],
    ]
    const rows = counts.flatMap(([name, n]) =>
      Array.from({ length: n }, (_, i) => seen(`sess-${i}`, name)))

    expect(worstDrop(buildFunnel(rows))?.event).toBe('onboarding_completed')
  })

  // A step with two people above it has a conversion rate that is noise, and
  // pointing at it would send somebody to rebuild a screen on the strength
  // of one bad afternoon.
  it('ignores a step with too few people above it', () => {
    const rows = [
      seen('sess-1', 'signup_started'),
      seen('sess-1', 'signup_submitted'),
    ]
    expect(worstDrop(buildFunnel(rows))).toBeNull()
  })
})

describe('weekOf', () => {
  it('buckets to the Monday', () => {
    // 2026-09-22 is a Tuesday.
    expect(weekOf('2026-09-22T10:00:00Z')).toBe('2026-09-21')
  })

  it('leaves a Monday where it is', () => {
    expect(weekOf('2026-09-21T00:00:00Z')).toBe('2026-09-21')
  })

  // The off-by-one everybody hits: Sunday belongs to the week that started
  // six days earlier, not to the one starting tomorrow.
  it('puts Sunday at the end of its week, not the start of the next', () => {
    expect(weekOf('2026-09-27T23:00:00Z')).toBe('2026-09-21')
  })
})

describe('buildCohorts', () => {
  const steps: EventName[] = ['signup_submitted', 'first_evidence']

  it('puts somebody in the week they first appeared', () => {
    const rows = [
      seen('sess-1', 'signup_started', '2026-09-22T10:00:00Z'),
      seen('sess-2', 'signup_started', '2026-09-29T10:00:00Z'),
    ]
    expect(buildCohorts(rows, steps).map((c) => c.week)).toEqual(['2026-09-28', '2026-09-21'])
  })

  // The case that makes cohorts worth having rather than just a second
  // funnel: somebody who signs up on Friday and scans on Monday converted.
  // Bucketing the later step by its own week would report two people each
  // half-doing something.
  it('credits a later step to the week they arrived in', () => {
    const rows = [
      seen('s-1', 'signup_started', '2026-09-25T10:00:00Z'),
      seen('s-1', 'first_evidence', '2026-09-30T10:00:00Z'),
    ]
    const cohorts = buildCohorts(rows, steps)
    expect(cohorts).toHaveLength(1)
    expect(cohorts[0].week).toBe('2026-09-21')
    expect(cohorts[0].reached.first_evidence).toBe(1)
  })

  it('counts each person once however many events they fired', () => {
    const rows = [
      seen('s-1', 'signup_started', '2026-09-22T09:00:00Z'),
      seen('s-1', 'signup_submitted', '2026-09-22T09:05:00Z'),
      seen('s-1', 'signup_submitted', '2026-09-22T09:06:00Z'),
    ]
    const c = buildCohorts(rows, steps)[0]
    expect(c.size).toBe(1)
    expect(c.reached.signup_submitted).toBe(1)
  })

  it('puts the newest week first, which is the one being looked at', () => {
    const rows = [
      seen('sess-old', 'signup_started', '2026-08-04T10:00:00Z'),
      seen('sess-new', 'signup_started', '2026-09-22T10:00:00Z'),
    ]
    expect(buildCohorts(rows, steps)[0].week).toBe('2026-09-21')
  })
})
