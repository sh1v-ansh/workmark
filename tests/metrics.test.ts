import { describe, it, expect } from 'vitest'
import {
  computeMetrics, capabilityFrontier, estimatorProfile, MIN_SAMPLE,
  type MetricTask, type MetricTransition, type MetricRevision, type MetricSubmission,
} from '../src/lib/workspace/metrics'
import type { TaskStatus } from '../src/lib/workspace/tasks'

const NOW = new Date('2026-04-01T12:00:00Z')

function task(id: string, over: Partial<MetricTask> = {}): MetricTask {
  return {
    id,
    assigneeId: 'alice',
    status: 'accepted',
    origin: 'student_created',
    estimateHours: 4,
    difficulty: 5,
    dueOn: null,
    verifiable: true,
    workRole: 'backend',
    createdAt: '2026-03-01T09:00:00Z',
    blockedAt: null,
    ...over,
  }
}

/** A task worked for `hours` and finished on `finishedAt`. */
function history(id: string, startAt: string, hours: number, finishedAt?: string): MetricTransition[] {
  const start = new Date(startAt)
  const end = new Date(start.getTime() + hours * 3_600_000)
  const rows: MetricTransition[] = [
    { taskId: id, toStatus: 'doing', occurredAt: start.toISOString() },
    { taskId: id, toStatus: 'submitted', occurredAt: end.toISOString() },
  ]
  if (finishedAt) rows.push({ taskId: id, toStatus: 'verified', occurredAt: finishedAt })
  return rows
}

const NO_REVISIONS: MetricRevision[] = []
const NO_SUBMISSIONS: MetricSubmission[] = []

describe('estimation', () => {
  // Four tasks each taking twice the estimate: a clear, consistent bias.
  const tasks = ['a', 'b', 'c', 'd'].map((id) => task(id, { estimateHours: 4 }))
  const transitions = tasks.flatMap((t, i) =>
    history(t.id, `2026-03-0${i + 1}T09:00:00Z`, 8, `2026-03-0${i + 1}T18:00:00Z`))

  it('measures error from the board, never from what anyone says', () => {
    const m = computeMetrics(tasks, transitions, NO_REVISIONS, NO_SUBMISSIONS, NOW)
    expect(m.estimation.bias.value).toBe(1)
    expect(m.estimation.bias.sample).toBe(4)
  })

  // Bias without spread misleads: somebody 80% out in both directions has a
  // bias near zero and is not a good estimator.
  it('separates being biased from being noisy', () => {
    const noisy = ['a', 'b', 'c', 'd'].map((id) => task(id, { estimateHours: 4 }))
    const swings = [
      ...history('a', '2026-03-01T09:00:00Z', 8, '2026-03-01T18:00:00Z'),
      ...history('b', '2026-03-02T09:00:00Z', 2, '2026-03-02T18:00:00Z'),
      ...history('c', '2026-03-03T09:00:00Z', 8, '2026-03-03T18:00:00Z'),
      ...history('d', '2026-03-04T09:00:00Z', 2, '2026-03-04T18:00:00Z'),
    ]
    // Errors alternate +100% and -50%. The median lands at 0.25, which is a
    // small bias — but the spread is 0.75, and that is the honest reading:
    // this person is not slightly optimistic, they are unpredictable.
    const m = computeMetrics(noisy, swings, NO_REVISIONS, NO_SUBMISSIONS, NOW)
    expect(m.estimation.bias.value).toBe(0.25)
    expect(m.estimation.spread.value).toBe(0.75)
    expect(estimatorProfile(m.estimation.bias, m.estimation.spread))
      .toBe('Estimates are noisy rather than biased: wrong in both directions.')
  })

  it('names a noisy estimator rather than calling them accurate', () => {
    expect(estimatorProfile({ value: 0, sample: 9 }, { value: 0.8, sample: 9 }))
      .toBe('Estimates are noisy rather than biased: wrong in both directions.')
    expect(estimatorProfile({ value: 0.05, sample: 9 }, { value: 0.1, sample: 9 }))
      .toBe('Estimates are close to what actually happens.')
  })

  // A figure from one task looks like knowledge and is not.
  it('reports nothing below the sample floor, but still says how many', () => {
    const few = [task('a'), task('b')]
    const m = computeMetrics(few, few.flatMap((t, i) =>
      history(t.id, `2026-03-0${i + 1}T09:00:00Z`, 8, `2026-03-0${i + 1}T18:00:00Z`)),
      NO_REVISIONS, NO_SUBMISSIONS, NOW)
    expect(MIN_SAMPLE).toBe(4)
    expect(m.estimation.bias.value).toBeNull()
    expect(m.estimation.bias.sample).toBe(2)
  })
})

describe('execution', () => {
  it('counts a commitment only when there was a date to miss', () => {
    const tasks = [task('a', { dueOn: null }), task('b', { dueOn: '2026-03-05' })]
    const m = computeMetrics(tasks, [
      ...history('a', '2026-03-01T09:00:00Z', 4, '2026-03-01T18:00:00Z'),
      ...history('b', '2026-03-02T09:00:00Z', 4, '2026-03-04T18:00:00Z'),
    ], NO_REVISIONS, NO_SUBMISSIONS, NOW)
    expect(m.execution.commitments).toBe(1)
    expect(m.execution.met).toBe(1)
  })

  // The figure most worth an employer's attention.
  it('measures how far ahead of the deadline a slip was flagged', () => {
    const revisions: MetricRevision[] = [{
      taskId: 'a', field: 'due_on',
      oldValue: '2026-03-10', newValue: '2026-03-14',
      reason: 'The events API turned out to be rate limited.',
      changedAt: '2026-03-06T09:00:00Z',
    }, {
      taskId: 'b', field: 'due_on',
      oldValue: '2026-03-20', newValue: '2026-03-22',
      reason: null, changedAt: '2026-03-18T09:00:00Z',
    }]
    const m = computeMetrics([task('a'), task('b')], [], revisions, NO_SUBMISSIONS, NOW)
    // Deadlines are dates (midnight); the changes were made at 09:00 — so
    // 3.625 and 1.625 days of warning, median 2.63. Counting whole days
    // would round somebody's warning up to a day they did not give.
    expect(m.execution.earlyWarningDays.value).toBe(2.63)
    expect(m.execution.renegotiations).toBe(2)
    expect(m.estimation.reasonsGiven).toBe(1)
  })

  it('ignores revisions to fields other than the deadline', () => {
    const m = computeMetrics([task('a')], [], [{
      taskId: 'a', field: 'estimate_hours', oldValue: '4', newValue: '7',
      reason: null, changedAt: '2026-03-06T09:00:00Z',
    }], NO_SUBMISSIONS, NOW)
    expect(m.execution.renegotiations).toBe(0)
  })
})

describe('the capability frontier', () => {
  const at = (difficulty: number, status: TaskStatus, id: string) =>
    task(id, { difficulty, status })

  it('is the hardest level still finished reliably', () => {
    const tasks = [
      at(3, 'accepted', 'a'), at(4, 'accepted', 'b'), at(5, 'accepted', 'c'),
      at(6, 'accepted', 'd'), at(9, 'doing', 'e'), at(9, 'doing', 'f'),
    ]
    // Clears everything up to 6; falls apart at 9.
    expect(capabilityFrontier(tasks)).toBe(6)
  })

  it('says nothing rather than guessing from a handful of tasks', () => {
    expect(capabilityFrontier([at(5, 'accepted', 'a'), at(5, 'accepted', 'b')])).toBeNull()
  })

  // Somebody who clears 7 has, by implication, cleared 4. Judging each level
  // alone makes the frontier jump around on one hard task nobody got to.
  it('is cumulative, not per level', () => {
    const tasks = [
      at(2, 'accepted', 'a'), at(4, 'accepted', 'b'),
      at(6, 'accepted', 'c'), at(7, 'accepted', 'd'), at(7, 'accepted', 'e'),
    ]
    expect(capabilityFrontier(tasks)).toBe(7)
  })

  it('does not count work nobody has started', () => {
    const tasks = [
      at(3, 'accepted', 'a'), at(3, 'accepted', 'b'),
      at(4, 'accepted', 'c'), at(4, 'accepted', 'd'),
      at(10, 'backlog', 'e'), at(10, 'backlog', 'f'),
    ]
    expect(capabilityFrontier(tasks)).toBe(4)
  })
})

describe('decomposition and checking', () => {
  it('reports what happened to the plan, without ranking it', () => {
    const tasks = [
      task('a', { origin: 'ai_proposed' }), task('b', { origin: 'ai_proposed' }),
      task('c', { origin: 'ai_edited' }), task('d', { origin: 'ai_edited' }),
      task('e', { origin: 'student_created' }),
    ]
    const m = computeMetrics(tasks, [], NO_REVISIONS, NO_SUBMISSIONS, NOW)
    expect(m.decomposition.aiProposed).toBe(2)
    expect(m.decomposition.aiEdited).toBe(2)
    expect(m.decomposition.studentCreated).toBe(1)
    expect(m.decomposition.acceptedAsIs.value).toBe(0.5)
  })

  it('counts first-time passes and tries to get there', () => {
    const submissions: MetricSubmission[] = [
      { taskId: 'a', verdict: 'verified', attempt: 1, decidedAt: null },
      { taskId: 'b', verdict: 'needs_work', attempt: 1, decidedAt: null },
      { taskId: 'b', verdict: 'verified', attempt: 2, decidedAt: null },
      { taskId: 'c', verdict: 'verified', attempt: 1, decidedAt: null },
      { taskId: 'd', verdict: 'needs_work', attempt: 1, decidedAt: null },
    ]
    const tasks = ['a', 'b', 'c', 'd'].map((id) => task(id))
    const m = computeMetrics(tasks, [], NO_REVISIONS, submissions, NOW)
    // Three of four first attempts were judged; two passed.
    expect(m.technical.firstTryPassRate.value).toBe(0.5)
    expect(m.debugging.medianAttemptsToPass.sample).toBe(3)
  })

  it('weights completion by difficulty rather than counting cards', () => {
    const m = computeMetrics([
      task('a', { difficulty: 2 }), task('b', { difficulty: 8 }),
      task('c', { difficulty: 3, status: 'doing' }),
    ], [], NO_REVISIONS, NO_SUBMISSIONS, NOW)
    expect(m.technical.completed).toBe(2)
    expect(m.technical.difficultyWeighted).toBe(10)
  })
})

describe('an empty project', () => {
  it('produces nulls and zeroes rather than throwing', () => {
    const m = computeMetrics([], [], [], [], NOW)
    expect(m.execution.onTimeRate.value).toBeNull()
    expect(m.estimation.bias.value).toBeNull()
    expect(m.technical.capabilityFrontier).toBeNull()
    expect(m.technical.completed).toBe(0)
    expect(m.computedAt).toBe(NOW.toISOString())
  })
})
