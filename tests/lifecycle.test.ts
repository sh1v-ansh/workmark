import { describe, it, expect } from 'vitest'
import {
  canTransition,
  allowedTransitions,
  canCloseOut,
  computeTrackRecord,
  isTerminal,
  type Stage,
} from '@/lib/engagements/lifecycle'

const ALL_STAGES: Stage[] = ['accepted', 'in_progress', 'submitted', 'closed', 'abandoned']

describe('stage machine — who may do what', () => {
  it('lets either side start the work', () => {
    expect(canTransition('accepted', 'in_progress', 'student')).toBe(true)
    expect(canTransition('accepted', 'in_progress', 'poster')).toBe(true)
  })

  it('lets only the student submit — they are the one who did the work', () => {
    expect(canTransition('in_progress', 'submitted', 'student')).toBe(true)
    expect(canTransition('in_progress', 'submitted', 'poster')).toBe(false)
  })

  it('lets the poster send work back for more rather than forcing close-or-abandon', () => {
    expect(canTransition('submitted', 'in_progress', 'poster')).toBe(true)
    expect(canTransition('submitted', 'in_progress', 'student')).toBe(false)
  })

  it('never lets the student close their own engagement — evidence must not be self-awarded', () => {
    expect(canTransition('submitted', 'closed', 'student')).toBe(false)
    expect(canTransition('submitted', 'closed', 'poster')).toBe(true)
  })

  it('lets either side abandon from any non-terminal stage', () => {
    for (const from of ['accepted', 'in_progress', 'submitted'] as Stage[]) {
      expect(canTransition(from, 'abandoned', 'student')).toBe(true)
      expect(canTransition(from, 'abandoned', 'poster')).toBe(true)
    }
  })

  it('treats closed and abandoned as terminal for everyone', () => {
    expect(isTerminal('closed')).toBe(true)
    expect(isTerminal('abandoned')).toBe(true)
    for (const to of ALL_STAGES) {
      expect(canTransition('closed', to, 'poster')).toBe(false)
      expect(canTransition('abandoned', to, 'student')).toBe(false)
    }
  })

  it('rejects skipping a stage', () => {
    expect(canTransition('accepted', 'submitted', 'student')).toBe(false)
    expect(canTransition('accepted', 'closed', 'poster')).toBe(false)
    expect(canTransition('in_progress', 'closed', 'poster')).toBe(false)
  })

  it('rejects a no-op transition to the same stage', () => {
    for (const s of ALL_STAGES) {
      expect(canTransition(s, s, 'student')).toBe(false)
    }
  })

  it('allowedTransitions agrees with canTransition for every pair', () => {
    for (const from of ALL_STAGES) {
      for (const actor of ['student', 'poster'] as const) {
        const allowed = allowedTransitions(from, actor)
        for (const to of ALL_STAGES) {
          expect(allowed.includes(to)).toBe(canTransition(from, to, actor))
        }
      }
    }
  })
})

describe('canCloseOut — the guard on minting evidence', () => {
  const ready = {
    stage: 'submitted' as Stage,
    description: 'Built the ingestion pipeline and the retry logic.',
    description_agreed_by_student_at: '2026-01-01T00:00:00Z',
    description_agreed_by_poster_at: '2026-01-02T00:00:00Z',
  }

  it('allows close-out when submitted and both parties agreed', () => {
    expect(canCloseOut(ready)).toEqual({ ok: true })
  })

  it('refuses before the work is submitted', () => {
    const r = canCloseOut({ ...ready, stage: 'in_progress' })
    expect(r.ok).toBe(false)
  })

  it('refuses with no description', () => {
    expect(canCloseOut({ ...ready, description: null }).ok).toBe(false)
    expect(canCloseOut({ ...ready, description: '   ' }).ok).toBe(false)
  })

  it('refuses when either party has not agreed', () => {
    expect(canCloseOut({ ...ready, description_agreed_by_student_at: null }).ok).toBe(false)
    expect(canCloseOut({ ...ready, description_agreed_by_poster_at: null }).ok).toBe(false)
  })

  it('gives a reason whenever it refuses, so the UI never shows a dead button', () => {
    const refusals = [
      canCloseOut({ ...ready, stage: 'accepted' }),
      canCloseOut({ ...ready, description: null }),
      canCloseOut({ ...ready, description_agreed_by_student_at: null }),
    ]
    for (const r of refusals) {
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason.length).toBeGreaterThan(0)
    }
  })
})

describe('computeTrackRecord', () => {
  it('reports no rate at all when nothing has finished', () => {
    expect(computeTrackRecord(['accepted', 'in_progress'])).toMatchObject({
      closeOutRate: null,
      active: 2,
      closed: 0,
      abandoned: 0,
    })
  })

  it('ignores in-flight engagements when computing the rate', () => {
    // 1 closed, 1 abandoned, 3 still running -> 50%, not 20%
    const r = computeTrackRecord(['closed', 'abandoned', 'accepted', 'in_progress', 'submitted'])
    expect(r.closeOutRate).toBeCloseTo(0.5)
    expect(r.active).toBe(3)
  })

  it('reports 1.0 when everything finished closed', () => {
    expect(computeTrackRecord(['closed', 'closed']).closeOutRate).toBe(1)
  })

  it('reports 0 when everything finished abandoned', () => {
    expect(computeTrackRecord(['abandoned', 'abandoned']).closeOutRate).toBe(0)
  })

  it('returns null rather than dividing by zero on an empty history', () => {
    expect(computeTrackRecord([]).closeOutRate).toBeNull()
  })
})
