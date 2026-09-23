import { describe, it, expect } from 'vitest'
import {
  isOpen, wantsBefore, pending, answered, approachForVerifier, answerRefusal,
  MIN_ANSWER, type Checkpoint,
} from '../src/lib/workspace/checkpoints'

function cp(extra: Partial<Checkpoint> = {}): Checkpoint {
  return {
    id: 'c1', taskId: 't1', kind: 'before', question: 'What will you try first?',
    answer: null, askedAt: '2026-09-01T00:00:00Z', answeredAt: null, skippedAt: null,
    ...extra,
  }
}

describe('isOpen', () => {
  it('is open until it is answered or skipped', () => {
    expect(isOpen(cp())).toBe(true)
  })

  // Skipping IS an answer — "not now". Asking again is the behaviour that
  // makes people stop reading these at all.
  it('treats a skip as settled, not as still waiting', () => {
    expect(isOpen(cp({ skippedAt: '2026-09-02T00:00:00Z' }))).toBe(false)
  })

  it('is closed once answered', () => {
    expect(isOpen(cp({ answeredAt: '2026-09-02T00:00:00Z', answer: 'Try a queue.' }))).toBe(false)
  })
})

describe('wantsBefore', () => {
  const base = { toStatus: 'doing', hadStartedBefore: false, hasChildren: false, existing: [] }

  it('asks once, as the card enters Doing', () => {
    expect(wantsBefore(base)).toBe(true)
  })

  it('asks nothing on any other move', () => {
    expect(wantsBefore({ ...base, toStatus: 'submitted' })).toBe(false)
  })

  // Moving a card back to Doing and forward again is not starting twice.
  it('does not ask again on a second pass through Doing', () => {
    expect(wantsBefore({ ...base, hadStartedBefore: true })).toBe(false)
  })

  it('does not ask twice even if the first was skipped', () => {
    expect(wantsBefore({ ...base, existing: [cp({ skippedAt: '2026-09-02T00:00:00Z' })] })).toBe(false)
  })

  // A parent entering Doing is a container being opened, not work starting.
  // Asking its approach asks about three pieces at once.
  it('leaves parent cards alone', () => {
    expect(wantsBefore({ ...base, hasChildren: true })).toBe(false)
  })
})

describe('pending', () => {
  it('surfaces one at a time, never a form', () => {
    const list = [cp({ id: 'a', answeredAt: '2026-09-02T00:00:00Z', answer: 'x' }), cp({ id: 'b' }), cp({ id: 'c' })]
    expect(pending(list)?.id).toBe('b')
  })

  it('is null when everything is settled', () => {
    expect(pending([cp({ skippedAt: '2026-09-02T00:00:00Z' })])).toBeNull()
  })
})

describe('answered', () => {
  it('ignores a blank answer that was somehow stored', () => {
    expect(answered([cp({ answeredAt: '2026-09-02T00:00:00Z', answer: '   ' })])).toHaveLength(0)
  })
})

describe('approachForVerifier', () => {
  // The whole point of the feature: a prediction to hold against the diff.
  it('frames a before answer as something said in advance', () => {
    const text = approachForVerifier([
      cp({ answeredAt: '2026-09-02T00:00:00Z', answer: 'Use a queue and retry failures.' }),
    ])
    expect(text).toMatch(/Before starting, they said they would: Use a queue/)
  })

  it('frames a blocked answer as what they had tried', () => {
    const text = approachForVerifier([
      cp({ kind: 'blocked', answeredAt: '2026-09-02T00:00:00Z', answer: 'Restarting the worker.' }),
    ])
    expect(text).toMatch(/While stuck, they said they had tried: Restarting/)
  })

  // A heading with nothing under it invites the model to comment on the
  // absence, which is not the student's failing and helps nobody.
  it('is empty rather than a heading with nothing under it', () => {
    expect(approachForVerifier([cp()])).toBe('')
    expect(approachForVerifier([])).toBe('')
  })
})

describe('answerRefusal', () => {
  it('accepts a short real answer', () => {
    expect(answerRefusal('Use a queue')).toBeNull()
  })

  it('refuses an empty one', () => {
    expect(answerRefusal('   ')).toMatch(/a few/i)
  })

  // The floor is low on purpose: set it higher and a fifteen-second question
  // becomes a writing task, which is how this starts getting skipped.
  it('keeps the floor low enough to stay answerable in seconds', () => {
    expect(MIN_ANSWER).toBeLessThanOrEqual(15)
  })
})
