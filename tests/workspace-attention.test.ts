import { describe, it, expect } from 'vitest'
import {
  chaseable, nudgeable, digest,
  CHASE_AFTER_DAYS, DRY_BOARD_TASKS, RENUDGE_AFTER_DAYS,
  type StaleReview, type BoardState,
} from '../src/lib/workspace/attention'

const NOW = new Date('2026-09-16T03:17:00Z')
const DAY = 86_400_000

/** A date this many days before NOW, as the database would hand it back. */
function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * DAY).toISOString()
}

function review(extra: Partial<StaleReview> = {}): StaleReview {
  return {
    submissionId: 'sub-1',
    workspaceId: 'ws-1',
    taskId: 'task-1',
    submittedAt: daysAgo(CHASE_AFTER_DAYS + 1),
    reviewChasedAt: null,
    ...extra,
  }
}

function board(extra: Partial<BoardState> = {}): BoardState {
  return {
    workspaceId: 'ws-1',
    openTasks: DRY_BOARD_TASKS,
    replanNudgedAt: null,
    deadline: null,
    ...extra,
  }
}

describe('chaseable', () => {
  it('chases a review that has waited past the threshold', () => {
    expect(chaseable([review()], NOW)).toHaveLength(1)
  })

  it('leaves a review that is still inside the threshold', () => {
    const fresh = review({ submittedAt: daysAgo(CHASE_AFTER_DAYS - 1) })
    expect(chaseable([fresh], NOW)).toHaveLength(0)
  })

  it('chases exactly on the threshold', () => {
    expect(chaseable([review({ submittedAt: daysAgo(CHASE_AFTER_DAYS) })], NOW)).toHaveLength(1)
  })

  // The whole reason the column exists. Without this the nightly pass would
  // send the same reminder every night for as long as the card stayed stuck,
  // which is how a sender gets filtered.
  it('never chases the same submission twice', () => {
    const already = review({ reviewChasedAt: daysAgo(1) })
    expect(chaseable([already], NOW)).toHaveLength(0)
  })

  it('does not chase again however long ago the first one was', () => {
    const ancient = review({ submittedAt: daysAgo(400), reviewChasedAt: daysAgo(370) })
    expect(chaseable([ancient], NOW)).toHaveLength(0)
  })
})

describe('nudgeable', () => {
  it('nudges a board at the dry threshold', () => {
    expect(nudgeable([board()], NOW)).toHaveLength(1)
  })

  it('nudges an empty board', () => {
    expect(nudgeable([board({ openTasks: 0 })], NOW)).toHaveLength(1)
  })

  it('leaves a board that still has work on it', () => {
    expect(nudgeable([board({ openTasks: DRY_BOARD_TASKS + 1 })], NOW)).toHaveLength(0)
  })

  it('does not nudge twice inside the cooldown', () => {
    const recent = board({ replanNudgedAt: daysAgo(RENUDGE_AFTER_DAYS - 1) })
    expect(nudgeable([recent], NOW)).toHaveLength(0)
  })

  it('nudges again once the cooldown has passed', () => {
    const old = board({ replanNudgedAt: daysAgo(RENUDGE_AFTER_DAYS + 1) })
    expect(nudgeable([old], NOW)).toHaveLength(1)
  })

  // Running out of work is the expected end state for a project that is over.
  // Telling somebody their board is nearly empty after the deadline is the
  // product failing to notice it succeeded.
  it('leaves a board whose deadline has passed', () => {
    expect(nudgeable([board({ deadline: daysAgo(1) })], NOW)).toHaveLength(0)
  })

  it('still nudges a board whose deadline is ahead of it', () => {
    const future = new Date(NOW.getTime() + 7 * DAY).toISOString()
    expect(nudgeable([board({ deadline: future })], NOW)).toHaveLength(1)
  })
})

describe('digest', () => {
  it('puts everything for one recipient in one bucket', () => {
    const rows = [
      { to: 'alice', task: 'a' },
      { to: 'bob', task: 'b' },
      { to: 'alice', task: 'c' },
    ]
    const grouped = digest(rows, (r) => r.to)
    expect(grouped.get('alice')).toHaveLength(2)
    expect(grouped.get('bob')).toHaveLength(1)
  })

  it('is empty for no input', () => {
    expect(digest([], () => 'x').size).toBe(0)
  })

  it('keeps the order items arrived in', () => {
    const grouped = digest([{ k: 'a', n: 1 }, { k: 'a', n: 2 }], (r) => r.k)
    expect(grouped.get('a')?.map((r) => r.n)).toEqual([1, 2])
  })
})
