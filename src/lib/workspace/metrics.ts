// Plan versus reality, as numbers.
//
// Nothing here is ever asked of a student. Every figure comes from timestamps
// the board already produced: they wrote one estimate and moved some cards,
// and the rest is arithmetic. That is the only reason these numbers are worth
// anything — a self-reported "this took me four hours" measures somebody's
// memory, not their work.
//
// Three rules run through all of it.
//
// Difficulty is the multiplier. Twenty easy tasks and five hard ones are not
// the same achievement, so completion counts are weighted and the headline
// figure is the capability frontier — the level where somebody stops being
// reliable — rather than a total.
//
// A wrong estimate is studied, not punished. Bias and spread are reported
// separately because they mean different things: somebody consistently 50%
// under is easy to work with, somebody randomly wrong is not.
//
// Nothing is reported from too little evidence. Every figure carries the
// sample it came from, and the ones below the floor come back null rather
// than as a number that looks like knowledge.

import { hoursInDoing, estimateError, type TaskStatus } from './tasks'
import type { WorkRole } from './membership'

/** Below this, a figure is an anecdote. It is reported as null. */
export const MIN_SAMPLE = 4

export interface MetricTask {
  id: string
  assigneeId: string | null
  status: TaskStatus
  origin: string
  estimateHours: number | null
  difficulty: number | null
  dueOn: string | null
  verifiable: boolean
  workRole: WorkRole | null
  createdAt: string | null
  blockedAt: string | null
}

export interface MetricTransition {
  taskId: string
  toStatus: string
  occurredAt: string
}

export interface MetricRevision {
  taskId: string
  field: string
  oldValue: string | null
  newValue: string | null
  reason: string | null
  changedAt: string
}

export interface MetricSubmission {
  taskId: string
  verdict: string
  attempt: number
  decidedAt: string | null
}

export interface Figure {
  value: number | null
  /** How many tasks or events this came from. Shown, never hidden. */
  sample: number
}

export interface WorkspaceMetrics {
  execution: {
    commitments: number
    met: number
    onTimeRate: Figure
    /** Days late, negative for early. Median, so one disaster does not define it. */
    medianDaysLate: Figure
    /** Days before the deadline they flagged a slip. Higher is better. */
    earlyWarningDays: Figure
    renegotiations: number
  }
  estimation: {
    /** Median signed error. Positive means they underestimate. */
    bias: Figure
    /** Median absolute error. How noisy they are, regardless of direction. */
    spread: Figure
    byRole: { role: WorkRole; bias: Figure }[]
    /** Why estimates moved, in their own words. */
    reasonsGiven: number
  }
  decomposition: {
    aiProposed: number
    aiEdited: number
    studentCreated: number
    /** Of what the planner suggested, the share kept as-is. */
    acceptedAsIs: Figure
  }
  technical: {
    completed: number
    difficultyWeighted: number
    /** Highest difficulty they still finish reliably. */
    capabilityFrontier: number | null
    firstTryPassRate: Figure
  }
  debugging: {
    blockedEpisodes: number
    medianAttemptsToPass: Figure
  }
  computedAt: string
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const value = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  return Math.round(value * 100) / 100
}

/** A figure, or null when the sample is too small to mean anything. */
function figure(values: number[], min = MIN_SAMPLE): Figure {
  return { value: values.length >= min ? median(values) : null, sample: values.length }
}

function rate(hits: number, total: number, min = MIN_SAMPLE): Figure {
  return { value: total >= min ? Math.round((hits / total) * 100) / 100 : null, sample: total }
}

const DONE: TaskStatus[] = ['verified', 'accepted']

function daysBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000
}

/**
 * Everything about one person on one project.
 *
 * Tasks are already filtered to them by the caller; transitions, revisions
 * and submissions are the whole project's and get matched here, because a
 * task's history is what makes its numbers.
 */
export function computeMetrics(
  tasks: MetricTask[],
  transitions: MetricTransition[],
  revisions: MetricRevision[],
  submissions: MetricSubmission[],
  now: Date = new Date(),
): WorkspaceMetrics {
  const transitionsByTask = new Map<string, MetricTransition[]>()
  for (const t of transitions) {
    const list = transitionsByTask.get(t.taskId)
    if (list) list.push(t)
    else transitionsByTask.set(t.taskId, [t])
  }

  const actualHours = new Map<string, number>()
  for (const task of tasks) {
    const rows = (transitionsByTask.get(task.id) ?? [])
      .map((t) => ({ to_status: t.toStatus, occurred_at: t.occurredAt }))
    actualHours.set(task.id, hoursInDoing(rows, now))
  }

  const finishedAt = new Map<string, string>()
  for (const task of tasks) {
    const done = (transitionsByTask.get(task.id) ?? [])
      .filter((t) => DONE.includes(t.toStatus as TaskStatus))
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))[0]
    if (done) finishedAt.set(task.id, done.occurredAt)
  }

  // ── Execution ──
  // A commitment is a task with a date on it. Work with no deadline was never
  // promised for a particular day, and counting it as late would punish
  // somebody for not making a promise.
  const committed = tasks.filter((t) => t.dueOn !== null)
  const finishedCommitments = committed.filter((t) => finishedAt.has(t.id))
  const lateness = finishedCommitments.map((t) => daysBetween(t.dueOn!, finishedAt.get(t.id)!))
  const met = lateness.filter((d) => d <= 0).length

  const deadlineMoves = revisions.filter((r) => r.field === 'due_on' && r.oldValue !== null)
  // How far ahead of the original date they said something would slip. This
  // is the number worth the most to an employer: a deadline missed but
  // flagged four days early beats one hit silently by working a weekend.
  const warningDays = deadlineMoves
    .map((r) => daysBetween(r.changedAt, r.oldValue!))
    .filter((d) => d > -30 && d < 120)

  // ── Estimation ──
  const estimated = tasks.filter((t) => t.estimateHours !== null && finishedAt.has(t.id))
  const errors = estimated
    .map((t) => estimateError(t.estimateHours, actualHours.get(t.id) ?? 0))
    .filter((e): e is number => e !== null)

  const roles = Array.from(new Set(estimated.map((t) => t.workRole).filter((r): r is WorkRole => !!r)))
  const byRole = roles.map((role) => ({
    role,
    bias: figure(
      estimated
        .filter((t) => t.workRole === role)
        .map((t) => estimateError(t.estimateHours, actualHours.get(t.id) ?? 0))
        .filter((e): e is number => e !== null),
      // A lower floor per role than overall: three tasks in one area is thin
      // but it is the shape of a real student project, and the sample is
      // always shown next to it.
      3,
    ),
  }))

  // ── Decomposition ──
  const aiProposed = tasks.filter((t) => t.origin === 'ai_proposed').length
  const aiEdited = tasks.filter((t) => t.origin === 'ai_edited').length
  const studentCreated = tasks.filter((t) => t.origin === 'student_created').length
  const fromPlan = aiProposed + aiEdited

  // ── Technical ──
  const done = tasks.filter((t) => DONE.includes(t.status))
  const difficultyWeighted = done.reduce((sum, t) => sum + (t.difficulty ?? 5), 0)

  const firstAttempts = submissions.filter((s) => s.attempt === 1 && s.verdict !== 'pending')
  const firstTryPasses = firstAttempts.filter((s) => s.verdict === 'verified').length

  // ── Debugging ──
  const attemptsToPass = submissions
    .filter((s) => s.verdict === 'verified')
    .map((s) => s.attempt)

  return {
    execution: {
      commitments: committed.length,
      met,
      onTimeRate: rate(met, finishedCommitments.length),
      medianDaysLate: figure(lateness),
      earlyWarningDays: figure(warningDays, 2),
      renegotiations: deadlineMoves.length,
    },
    estimation: {
      bias: figure(errors),
      spread: figure(errors.map(Math.abs)),
      byRole,
      reasonsGiven: revisions.filter((r) => r.reason !== null && r.reason.trim() !== '').length,
    },
    decomposition: {
      aiProposed,
      aiEdited,
      studentCreated,
      acceptedAsIs: rate(aiProposed, fromPlan),
    },
    technical: {
      completed: done.length,
      difficultyWeighted,
      capabilityFrontier: capabilityFrontier(tasks),
      firstTryPassRate: rate(firstTryPasses, firstAttempts.length),
    },
    debugging: {
      blockedEpisodes: tasks.filter((t) => t.blockedAt !== null).length,
      medianAttemptsToPass: figure(attemptsToPass),
    },
    computedAt: now.toISOString(),
  }
}

/**
 * The hardest level somebody still finishes reliably.
 *
 * Walks up the difficulty scale and stops at the last level where they are
 * still succeeding. Reported as one number because it is the honest summary:
 * not how much they did, but how hard it got before it stopped working.
 *
 * Null until there is enough at any level to say. A frontier guessed from two
 * tasks is a number that looks like knowledge and is not.
 */
export function capabilityFrontier(tasks: MetricTask[], threshold = 0.7): number | null {
  const attempted = tasks.filter((t) => t.difficulty !== null && t.status !== 'backlog')
  if (attempted.length < MIN_SAMPLE) return null

  // Only levels somebody actually attempted. Walking 1..10 looks equivalent
  // and is not: levels above the hardest real task have the same cumulative
  // set as the one below them, so the frontier kept ratcheting through empty
  // levels and reported 8 for somebody whose hardest finished task was a 6.
  // Overclaiming on a person's record is the one direction this must not
  // fail in.
  const levels = Array.from(new Set(attempted.map((t) => t.difficulty as number))).sort((a, b) => a - b)

  let frontier: number | null = null
  for (const level of levels) {
    // Everything at this level and below: somebody who clears 7 has, by
    // implication, cleared 4. Judging each level in isolation makes the
    // frontier jump around on one hard task nobody got to.
    const upTo = attempted.filter((t) => (t.difficulty ?? 0) <= level)
    const succeeded = upTo.filter((t) => DONE.includes(t.status)).length
    if (succeeded / upTo.length >= threshold) frontier = level
  }
  return frontier
}

/**
 * Whether the estimate errors point one way or scatter.
 *
 * Bias without spread is misleading: somebody with a bias of 0 who is 80%
 * out in both directions is not a good estimator, they are a lucky average.
 */
export function estimatorProfile(bias: Figure, spread: Figure): string | null {
  if (bias.value === null || spread.value === null) return null
  if (spread.value < 0.25) return 'Estimates are close to what actually happens.'
  if (bias.value > 0.3) return 'Consistently underestimates — work takes longer than planned.'
  if (bias.value < -0.3) return 'Consistently overestimates — work finishes ahead of plan.'
  return 'Estimates are noisy rather than biased: wrong in both directions.'
}
