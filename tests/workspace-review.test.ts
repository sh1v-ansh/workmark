import { describe, it, expect } from 'vitest'
import {
  canReview, outcomeFor, hasEligibleReviewer, awaitingReview,
  HUMAN_VERDICTS, REVIEWABLE_VERDICT,
  type ReviewableTask,
} from '../src/lib/workspace/review'
import type { MemberRow } from '../src/lib/workspace/membership'

function member(account_id: string, extra: Partial<MemberRow> = {}): MemberRow {
  return {
    account_id,
    role: 'member',
    accepted_at: '2026-01-01T00:00:00Z',
    removed_at: null,
    ...extra,
  }
}

/** A task in the one state a person is ever asked about. */
function reviewable(extra: Partial<ReviewableTask> = {}): ReviewableTask {
  return {
    id: 'task-1',
    status: 'submitted',
    assigneeId: 'alice',
    submittedById: 'alice',
    latestVerdict: REVIEWABLE_VERDICT,
    humanVerdict: null,
    ...extra,
  }
}

const TEAM = [member('alice', { role: 'owner' }), member('bob')]

describe('canReview', () => {
  it('lets a teammate answer a task waiting on a person', () => {
    expect(canReview(TEAM, 'bob', reviewable())).toBeNull()
  })

  // The rule the whole path exists to protect. Verified evidence somebody can
  // write about their own work is evidence worth nothing.
  it('never lets the assignee confirm their own work', () => {
    expect(canReview(TEAM, 'alice', reviewable())).toMatch(/you did the work/i)
  })

  // The assignee is not a reliable record of who did the work: the column is
  // nullable, nothing forces a card to be assigned before it is submitted,
  // and it empties on account deletion. Each of those used to hand the
  // submitter a way to confirm their own work.
  it('never lets the submitter confirm their own work on an unassigned task', () => {
    const task = reviewable({ assigneeId: null, submittedById: 'alice' })
    expect(canReview(TEAM, 'alice', task)).toMatch(/you did the work/i)
  })

  it('never lets the submitter confirm work assigned to somebody else', () => {
    const task = reviewable({ assigneeId: 'bob', submittedById: 'alice' })
    expect(canReview(TEAM, 'alice', task)).toMatch(/you did the work/i)
  })

  it('still lets an uninvolved teammate answer an unassigned task', () => {
    const task = reviewable({ assigneeId: null, submittedById: 'alice' })
    expect(canReview(TEAM, 'bob', task)).toBeNull()
  })

  it('refuses somebody who is not on the team', () => {
    expect(canReview(TEAM, 'carol', reviewable())).toMatch(/not on this project/i)
  })

  it('refuses a member who was removed', () => {
    const team = [member('alice'), member('bob', { removed_at: '2026-02-01T00:00:00Z' })]
    expect(canReview(team, 'bob', reviewable())).toMatch(/not on this project/i)
  })

  it('refuses somebody who has not accepted their invitation', () => {
    const team = [member('alice'), member('bob', { accepted_at: null })]
    expect(canReview(team, 'bob', reviewable())).toMatch(/not on this project/i)
  })

  it('refuses a task that is not in Submitted', () => {
    expect(canReview(TEAM, 'bob', reviewable({ status: 'doing' })))
      .toMatch(/not waiting to be checked/i)
  })

  it('asks for a check first when nothing has been submitted', () => {
    expect(canReview(TEAM, 'bob', reviewable({ latestVerdict: null })))
      .toMatch(/run a check/i)
  })

  // Only the two cases the checker cannot settle reach a person. A verdict it
  // did reach does not want a second opinion pasted over it.
  it('refuses a task the checker already answered', () => {
    for (const verdict of ['verified', 'needs_work', 'pending']) {
      expect(canReview(TEAM, 'bob', reviewable({ latestVerdict: verdict })))
        .toMatch(/already answered/i)
    }
  })

  it('refuses a second answer on the same submission', () => {
    expect(canReview(TEAM, 'bob', reviewable({ humanVerdict: 'works' })))
      .toMatch(/already answered/i)
  })

  // Was "reviewable by anyone on the team", which included the person who
  // submitted it. An unassigned card is open to everyone the work was not
  // done by, and to nobody else.
  it('treats an unassigned task as reviewable by anyone who did not do it', () => {
    const task = reviewable({ assigneeId: null, submittedById: 'alice' })
    expect(canReview(TEAM, 'alice', task)).toMatch(/you did the work/i)
    expect(canReview(TEAM, 'bob', task)).toBeNull()
  })

  // Nothing is known about who did the work, so nothing bars anyone. This is
  // the only case where an unassigned card is open to the whole team, and it
  // is reachable when an account is deleted after submitting.
  it('falls back to the team when neither assignee nor submitter is known', () => {
    const task = reviewable({ assigneeId: null, submittedById: null })
    expect(canReview(TEAM, 'alice', task)).toBeNull()
    expect(canReview(TEAM, 'bob', task)).toBeNull()
  })
})

describe('hasEligibleReviewer', () => {
  it('is false on a solo project — the only member did the work', () => {
    expect(hasEligibleReviewer([member('alice')], reviewable())).toBe(false)
  })

  it('is true when somebody else is on the team', () => {
    expect(hasEligibleReviewer(TEAM, reviewable())).toBe(true)
  })

  // This used to assert the opposite, which is how the hole got in: an
  // unassigned task on a solo project looked as though somebody could
  // answer it, and the only candidate was the student who submitted it.
  it('is false for an unassigned task the solo student submitted', () => {
    const task = reviewable({ assigneeId: null, submittedById: 'alice' })
    expect(hasEligibleReviewer([member('alice')], task)).toBe(false)
  })

  it('does not count a removed member as eligible', () => {
    const team = [member('alice'), member('bob', { removed_at: '2026-02-01T00:00:00Z' })]
    expect(hasEligibleReviewer(team, reviewable())).toBe(false)
  })
})

describe('outcomeFor', () => {
  it('sends confirmed work to Verified', () => {
    const o = outcomeFor('works')
    expect(o.submissionVerdict).toBe('human_verified')
    expect(o.taskStatus).toBe('verified')
  })

  // Back to Doing rather than left in Submitted: a card in Submitted reads as
  // waiting on Workmark, and this one is waiting on the student.
  it('sends partly-working and broken work back to Doing', () => {
    for (const verdict of ['partly_works', 'does_not_work'] as const) {
      const o = outcomeFor(verdict)
      expect(o.submissionVerdict).toBe('needs_work')
      expect(o.taskStatus).toBe('doing')
    }
  })

  it("leaves the card alone when the reviewer cannot tell", () => {
    const o = outcomeFor('not_checked')
    expect(o.taskStatus).toBeNull()
    expect(o.submissionVerdict).toBe('unverifiable')
  })

  // human_verdict is what canReview reads to decide a task has been answered.
  // Writing it for "I can't tell" would mean the first person to shrug locks
  // everybody else out of a question nobody actually answered.
  it('does not count "I cannot tell" as an answer', () => {
    expect(outcomeFor('not_checked').recordsAnswer).toBe(false)
    for (const verdict of ['works', 'partly_works', 'does_not_work'] as const) {
      expect(outcomeFor(verdict).recordsAnswer).toBe(true)
    }
  })

  // The pair that has to stay in step: anything that closes the question moves
  // the card or sends it back, and the one that does not leaves it alone.
  it('closes the question exactly when it changes something', () => {
    for (const verdict of HUMAN_VERDICTS) {
      const o = outcomeFor(verdict)
      expect(o.recordsAnswer).toBe(o.taskStatus !== null)
    }
  })

  it('says something back for every verdict', () => {
    for (const verdict of HUMAN_VERDICTS) {
      expect(outcomeFor(verdict).message.length).toBeGreaterThan(0)
    }
  })

  // Only 'works' may produce evidence. If another verdict ever reaches
  // human_verified, a student gets a Verified card for work somebody said was
  // broken.
  it('produces a verified answer for exactly one verdict', () => {
    const verified = HUMAN_VERDICTS.filter((v) => outcomeFor(v).submissionVerdict === 'human_verified')
    expect(verified).toEqual(['works'])
  })
})

describe('awaitingReview', () => {
  it('returns only what this person may answer', () => {
    const tasks = [
      reviewable({ id: 'a', assigneeId: 'alice' }),  // bob may answer
      reviewable({ id: 'b', assigneeId: 'bob' }),    // bob did it
      reviewable({ id: 'c', latestVerdict: 'verified' }),
    ]
    expect(awaitingReview(TEAM, 'bob', tasks).map((t) => t.id)).toEqual(['a'])
  })

  it('is empty rather than throwing when there is nothing to do', () => {
    expect(awaitingReview(TEAM, 'bob', [])).toEqual([])
  })
})
