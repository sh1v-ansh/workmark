import { describe, it, expect } from 'vitest'
import {
  BOARD_COLUMNS, canMoveTo, positionBetween, byBoardOrder,
  revisionsFor, wantsReason, hoursInDoing, estimateError,
  type TaskStatus,
} from '../src/lib/workspace/tasks'

describe('moving a card', () => {
  // The one that matters. A board where you can mark your own work verified
  // produces evidence worth nothing.
  it('nobody may move a task into Verified', () => {
    for (const from of BOARD_COLUMNS) {
      // 'accepted' has its own, more specific refusal — see below.
      if (from === 'verified' || from === 'accepted') continue
      expect(canMoveTo(from, 'verified'))
        .toBe('Workmark decides this one — submit the task and it gets checked.')
    }
  })

  // Both refusals are true for an accepted card. "This task is closed" is
  // the more useful of the two, so it wins.
  it('prefers the closed message over the verified one for a finished task', () => {
    expect(canMoveTo('accepted', 'verified')).toBe('This task is closed.')
  })

  it('accepted is only reachable from verified', () => {
    expect(canMoveTo('verified', 'accepted')).toBeNull()
    expect(canMoveTo('doing', 'accepted')).toBe('A task has to be verified before it can be accepted.')
    expect(canMoveTo('submitted', 'accepted')).toBe('A task has to be verified before it can be accepted.')
  })

  it('nothing moves out of accepted', () => {
    for (const to of BOARD_COLUMNS) {
      if (to === 'accepted') continue
      expect(canMoveTo('accepted', to)).toBe('This task is closed.')
    }
  })

  // Refusing this just teaches people to delete the card and make a new one,
  // which loses the history the whole feature exists to keep.
  it('allows going backwards when something turns out not to be done', () => {
    expect(canMoveTo('submitted', 'doing')).toBeNull()
    expect(canMoveTo('doing', 'backlog')).toBeNull()
    expect(canMoveTo('verified', 'doing')).toBeNull()
  })

  it('a move to the same column is a no-op, not an error', () => {
    for (const c of BOARD_COLUMNS) expect(canMoveTo(c, c)).toBeNull()
  })
})

describe('position', () => {
  it('puts a first card, and appends after the last', () => {
    expect(positionBetween(null, null)).toBe(1000)
    expect(positionBetween(2000, null)).toBe(3000)
  })

  it('drops a card between two others without renumbering either', () => {
    expect(positionBetween(1000, 2000)).toBe(1500)
    expect(positionBetween(1000, 1500)).toBe(1250)
  })

  it('places above the first card', () => {
    expect(positionBetween(null, 1000)).toBe(0)
  })

  // Halving stays ordered for far longer than any real board needs.
  it('survives repeated drops into the same gap', () => {
    let low = 1000
    const high = 2000
    for (let i = 0; i < 20; i++) {
      const next = positionBetween(low, high)
      expect(next).toBeGreaterThan(low)
      expect(next).toBeLessThan(high)
      low = next
    }
  })

  it('sorts by position, oldest first when they tie', () => {
    const rows = [
      { position: 2000, createdAt: '2026-01-01T00:00:00Z' },
      { position: 1000, createdAt: '2026-01-03T00:00:00Z' },
      { position: 1000, createdAt: '2026-01-02T00:00:00Z' },
    ]
    expect([...rows].sort(byBoardOrder).map((r) => r.createdAt)).toEqual([
      '2026-01-02T00:00:00Z', '2026-01-03T00:00:00Z', '2026-01-01T00:00:00Z',
    ])
  })
})

describe('revisions', () => {
  const current = { title: 'Auth', estimate_hours: 4, due_on: '2026-03-01', difficulty: 5 }

  it('records only what actually changed', () => {
    const out = revisionsFor(current, { estimate_hours: 7, title: 'Auth' })
    expect(out).toEqual([{ field: 'estimate_hours', oldValue: '4', newValue: '7' }])
  })

  // A form posts every field on every save. A history full of "4 → 4" is a
  // history nobody reads.
  it('writes nothing when a form resubmits unchanged values', () => {
    expect(revisionsFor(current, { title: 'Auth', estimate_hours: 4, difficulty: 5 })).toEqual([])
  })

  it('records clearing a field', () => {
    expect(revisionsFor(current, { due_on: null }))
      .toEqual([{ field: 'due_on', oldValue: '2026-03-01', newValue: null }])
  })

  it('ignores fields that are not part of the plan', () => {
    expect(revisionsFor(current, { status: 'doing', position: 1500 })).toEqual([])
  })

  // Prompting on every edit trains people to dismiss the box, and then the
  // ones that matter get dismissed too.
  it('asks why only for the two changes worth explaining', () => {
    expect(wantsReason('estimate_hours')).toBe(true)
    expect(wantsReason('due_on')).toBe(true)
    expect(wantsReason('title')).toBe(false)
    expect(wantsReason('priority')).toBe(false)
  })
})

describe('how long it actually took', () => {
  const t = (to: TaskStatus, iso: string) => ({ to_status: to, occurred_at: iso })
  const now = new Date('2026-03-01T18:00:00Z')

  it('measures time in Doing, never what anyone claims', () => {
    expect(hoursInDoing([
      t('backlog', '2026-03-01T08:00:00Z'),
      t('doing', '2026-03-01T09:00:00Z'),
      t('submitted', '2026-03-01T13:00:00Z'),
    ], now)).toBe(4)
  })

  // Picked up, put down, picked up again: count the work, not the gap.
  it('adds up separate stretches and ignores the time in between', () => {
    expect(hoursInDoing([
      t('doing', '2026-03-01T09:00:00Z'),
      t('backlog', '2026-03-01T10:00:00Z'),
      t('doing', '2026-03-01T15:00:00Z'),
      t('submitted', '2026-03-01T17:00:00Z'),
    ], now)).toBe(3)
  })

  it('keeps counting while a card is still open', () => {
    expect(hoursInDoing([t('doing', '2026-03-01T16:00:00Z')], now)).toBe(2)
  })

  it('is zero for a task nobody started', () => {
    expect(hoursInDoing([t('backlog', '2026-03-01T08:00:00Z')], now)).toBe(0)
    expect(hoursInDoing([], now)).toBe(0)
  })

  it('does not care what order the rows arrive in', () => {
    expect(hoursInDoing([
      t('submitted', '2026-03-01T13:00:00Z'),
      t('doing', '2026-03-01T09:00:00Z'),
    ], now)).toBe(4)
  })
})

describe('estimate error', () => {
  it('is positive when it took longer than planned', () => {
    expect(estimateError(4, 6)).toBe(0.5)
    expect(estimateError(4, 2)).toBe(-0.5)
    expect(estimateError(4, 4)).toBe(0)
  })

  it('says nothing rather than guessing when there was no estimate', () => {
    expect(estimateError(null, 6)).toBeNull()
    expect(estimateError(0, 6)).toBeNull()
  })
})
