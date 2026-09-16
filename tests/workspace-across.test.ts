import { describe, it, expect } from 'vitest'
import {
  computeMetrics, MIN_SAMPLE,
  type MetricTask, type MetricTransition,
} from '../src/lib/workspace/metrics'

/**
 * These tests are about one claim: pooling the raw rows and averaging the
 * per-project summaries give different answers, and the difference is not
 * small. across.ts pools for that reason, and this is the evidence.
 */

const NOW = new Date('2026-09-16T00:00:00Z')

function task(id: string, estimate: number, extra: Partial<MetricTask> = {}): MetricTask {
  return {
    id, parentTaskId: null, assigneeId: 'alice', status: 'verified', origin: 'student_created',
    estimateHours: estimate, difficulty: 5, dueOn: null, verifiable: true,
    workRole: null, createdAt: '2026-09-01T00:00:00Z', blockedAt: null, ...extra,
  }
}

/** Start at 09:00, finish `hours` later — so actual time in Doing is known. */
function worked(id: string, hours: number): MetricTransition[] {
  const start = Date.UTC(2026, 8, 10, 9, 0, 0)
  return [
    { taskId: id, toStatus: 'doing', occurredAt: new Date(start).toISOString() },
    { taskId: id, toStatus: 'verified', occurredAt: new Date(start + hours * 3_600_000).toISOString() },
  ]
}

describe('pooling is not averaging', () => {
  // A long project where estimates were good, and a short one where they
  // were terrible. Both are above MIN_SAMPLE — below it neither produces a
  // figure and there is nothing to average, which is itself worth knowing.
  // Averaging the two medians weights them equally; pooling does not, because
  // twelve tasks outvote four.
  const big = Array.from({ length: 12 }, (_, i) => task(`b${i}`, 4))
  const bigWork = big.flatMap((t) => worked(t.id, 4))
  const small = Array.from({ length: MIN_SAMPLE }, (_, i) => task(`s${i}`, 1))
  const smallWork = small.flatMap((t) => worked(t.id, 4))

  it('does not let a four-task project weigh as much as a twelve-task one', () => {
    const bigBias = computeMetrics(big, bigWork, [], [], NOW).estimation.bias.value!
    const smallBias = computeMetrics(small, smallWork, [], [], NOW).estimation.bias.value!
    const averaged = (bigBias + smallBias) / 2

    const pooled = computeMetrics(
      [...big, ...small], [...bigWork, ...smallWork], [], [], NOW,
    ).estimation.bias.value!

    // The small project is wildly off and the big one is exact, so averaging
    // reports a badly skewed figure while the pooled median stays near the
    // truth. If these ever coincide the test has stopped proving anything.
    expect(smallBias).toBeGreaterThan(bigBias)
    expect(Math.abs(pooled - averaged)).toBeGreaterThan(0.5)
    expect(pooled).toBeCloseTo(bigBias, 1)
  })

  it('reports the pooled sample, not a count of projects', () => {
    const pooled = computeMetrics([...big, ...small], [...bigWork, ...smallWork], [], [], NOW)
    expect(pooled.estimation.bias.sample).toBe(16)
  })
})

describe('the sample floor applies to the pool', () => {
  // Two tasks on each of three projects is six tasks. Per project every
  // figure is null; pooled, the question the floor asks is answered.
  const scattered = Array.from({ length: MIN_SAMPLE + 2 }, (_, i) => task(`t${i}`, 4))
  const work = scattered.flatMap((t) => worked(t.id, 5))

  it('says nothing from a project too small on its own', () => {
    const one = computeMetrics(scattered.slice(0, 2), work.slice(0, 4), [], [], NOW)
    expect(one.estimation.bias.value).toBeNull()
    expect(one.estimation.bias.sample).toBe(2)
  })

  it('answers once the pooled sample is big enough', () => {
    const all = computeMetrics(scattered, work, [], [], NOW)
    expect(all.estimation.bias.value).not.toBeNull()
    expect(all.estimation.bias.sample).toBe(scattered.length)
  })
})

describe('subtasks do not double-count across projects either', () => {
  // The same rule as rollup.ts. A parent counted alongside its children would
  // inflate the pooled figure exactly as it inflated the per-project one.
  it('drops parents from the pool', () => {
    const rows = [
      task('parent', 4),
      task('kid1', 4, { parentTaskId: 'parent' }),
      task('kid2', 4, { parentTaskId: 'parent' }),
    ]
    const parents = new Set(rows.map((r) => r.parentTaskId).filter(Boolean))
    const leaves = rows.filter((r) => !parents.has(r.id))
    expect(leaves.map((l) => l.id)).toEqual(['kid1', 'kid2'])
  })
})
