// The week, as rules rather than as a screen.
//
// A sprint is the only place in Workmark where somebody is asked to commit to
// an amount of work before doing it, and then shown what actually happened.
// That gap — planned against delivered, and the reasons given when an
// estimate moved — is the single most informative thing this product records,
// and everything else on the board is in service of measuring it.
//
// ── Why a week, and why it is not configurable ────────────────────────────
// A student term is weeks. A fortnight hides a slip until it is too late to
// renegotiate, and anything shorter is ceremony. Offering the choice costs
// every team a ten-minute decision with no good answer, and produces boards
// that cannot be compared with each other.
//
// Pure, like tasks.ts and review.ts, so the route and the board agree about
// what is in a sprint and whether it can be closed.

import type { TaskStatus } from './tasks'

/** The length of a sprint, in days. See above for why it is not a setting. */
export const SPRINT_DAYS = 7

/**
 * How far past its end date a sprint can run before the board starts saying
 * so. One day, because "ends Friday" and reviewing it Monday morning is
 * normal and should not be nagged about; a week late is a sprint nobody
 * closed, which is worth pointing at.
 */
export const OVERDUE_GRACE_DAYS = 1

const DAY = 86_400_000

export interface Sprint {
  id: string
  name: string
  goal: string | null
  startsOn: string
  endsOn: string
  closedAt: string | null
  retro: string | null
}

export interface SprintTask {
  id: string
  title: string
  status: TaskStatus
  sprintId: string | null
  estimateHours: number | null
  difficulty: number | null
}

/** The one sprint still open, if there is one. */
export function currentSprint(sprints: Sprint[]): Sprint | null {
  return sprints.find((s) => s.closedAt === null) ?? null
}

function dayDiff(from: string, to: Date): number {
  return (to.getTime() - new Date(from).getTime()) / DAY
}

/**
 * The moment a date stops being that date.
 *
 * `ends_on` is a DATE, so it parses at midnight at the *start* of the day. A
 * sprint that "ends on the 15th" is not over at one minute past midnight on
 * the 15th — it is over when the 15th is. Comparing against the raw parse ate
 * the whole grace period: a sprint ending yesterday read as overdue by 09:00
 * this morning.
 */
function endOfDay(date: string): number {
  return new Date(date).getTime() + DAY
}

/**
 * Whether the open sprint has run past its end date and nobody has looked.
 *
 * Surfaced rather than enforced. A sprint that auto-closed on its end date
 * would produce a retro nobody read about work nobody had finished, which is
 * worse than one that is visibly late.
 */
export function isOverdue(sprint: Sprint, now: Date): boolean {
  if (sprint.closedAt !== null) return false
  return (now.getTime() - endOfDay(sprint.endsOn)) / DAY > OVERDUE_GRACE_DAYS
}

/**
 * Days left, negative once it is over.
 *
 * Counted from the start of ends_on rather than its end, unlike isOverdue
 * above, and the difference is deliberate: a sprint ending on the 19th when
 * today is the 16th has three days left, which is how somebody counts it on
 * a calendar. Using end-of-day here would say four.
 */
export function daysRemaining(sprint: Sprint, now: Date): number {
  return Math.ceil(dayDiff(now.toISOString(), new Date(sprint.endsOn)))
}

export interface SprintProgress {
  committed: number
  done: number
  inFlight: number
  setAside: number
  notStarted: number
  /** Estimated hours committed, where estimates were given. */
  hoursCommitted: number
  /** Share of committed tasks finished, or null before anything was committed. */
  share: number | null
}

/**
 * What the sprint looks like right now.
 *
 * Set-aside work is counted apart from both done and outstanding, because it
 * is neither. Folding it into "done" would flatter the week; folding it into
 * "not finished" would punish the student for being honest about an approach
 * that failed, which is the behaviour the status exists to make safe.
 */
export function progressOf(sprint: Sprint, tasks: SprintTask[]): SprintProgress {
  const mine = tasks.filter((t) => t.sprintId === sprint.id)
  const done = mine.filter((t) => t.status === 'verified' || t.status === 'accepted')
  const setAside = mine.filter((t) => t.status === 'abandoned')
  const inFlight = mine.filter((t) => t.status === 'doing' || t.status === 'submitted')
  const notStarted = mine.filter((t) => t.status === 'backlog' || t.status === 'planned')

  // The denominator excludes set-aside work for the same reason
  // capabilityFrontier does: it is not a failure to have found out.
  const counted = mine.length - setAside.length

  return {
    committed: mine.length,
    done: done.length,
    inFlight: inFlight.length,
    setAside: setAside.length,
    notStarted: notStarted.length,
    hoursCommitted: mine.reduce((sum, t) => sum + (t.estimateHours ?? 0), 0),
    share: counted > 0 ? done.length / counted : null,
  }
}

/**
 * May this sprint be closed?
 *
 * Deliberately permissive. A sprint with work still open is the normal case —
 * that is what a retro is for — so the only refusal is closing one that is
 * already closed. Requiring an empty board before review would teach people
 * to close sprints by emptying them, which is the opposite of the point.
 */
export function canClose(sprint: Sprint): string | null {
  return sprint.closedAt === null ? null : 'This sprint has already been reviewed.'
}

/**
 * The dates for the next sprint.
 *
 * Starts today rather than the day after the last one ended. A team that
 * reviewed late should not get a sprint that is already two days old, and a
 * calendar that quietly drifts behind reality is one people stop trusting.
 */
export function nextDates(now: Date): { startsOn: string; endsOn: string } {
  const start = new Date(now)
  const end = new Date(now.getTime() + (SPRINT_DAYS - 1) * DAY)
  return { startsOn: iso(start), endsOn: iso(end) }
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * What to call it.
 *
 * Numbered rather than dated, because "Week 3" is how somebody refers to it
 * out loud and a date range is something they have to decode.
 */
export function nextName(existing: Sprint[]): string {
  return `Week ${existing.length + 1}`
}

/**
 * The facts a retro is written from, as prose.
 *
 * Short on purpose. The model is not being asked to analyse a dataset; it is
 * being given the handful of things that distinguish a good week from a bad
 * one, and asked to say which this was in a way a student can act on.
 */
export function retroBrief(
  sprint: Sprint,
  tasks: SprintTask[],
  extras: { slipped: { title: string; reason: string | null }[]; setbacks: { title: string; note: string | null }[] },
): string {
  const p = progressOf(sprint, tasks)
  const lines = [
    `Sprint: ${sprint.name}${sprint.goal ? ` — goal: ${sprint.goal}` : ' (no goal was set)'}`,
    `Committed ${p.committed} task(s), ${p.hoursCommitted || 'no'} estimated hours.`,
    `Finished ${p.done}. Still open ${p.inFlight + p.notStarted}. Set aside ${p.setAside}.`,
  ]

  if (extras.slipped.length > 0) {
    lines.push('Estimates or deadlines that moved, with the reason given:')
    for (const s of extras.slipped.slice(0, 8)) {
      lines.push(`- ${s.title}: ${s.reason ?? 'no reason given'}`)
    }
  }

  if (extras.setbacks.length > 0) {
    lines.push('Work that came back or was set aside:')
    for (const s of extras.setbacks.slice(0, 8)) {
      lines.push(`- ${s.title}${s.note ? `: ${s.note}` : ''}`)
    }
  }

  return lines.join('\n')
}

/**
 * One shape for a sprint row, so every reader agrees.
 *
 * Lives here rather than beside the query, because a Next route file may only
 * export HTTP handlers — exporting a helper from one is a build error, not a
 * style preference.
 */
export function toSprint(row: Record<string, unknown>): Sprint {
  return {
    id: row.id as string,
    name: row.name as string,
    goal: (row.goal as string | null) ?? null,
    startsOn: row.starts_on as string,
    endsOn: row.ends_on as string,
    closedAt: (row.closed_at as string | null) ?? null,
    retro: (row.retro as string | null) ?? null,
  }
}
