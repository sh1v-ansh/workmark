// The funnel, from events rather than from row counts.
//
// ── What the old one could not answer ─────────────────────────────────────
// loadFunnel in stats.ts counts rows: students, github_connections,
// applications. That is "how many people are at each stage right now", and
// it cannot answer anything else — most importantly it has no failures in
// it. Somebody who opened the signup form and left leaves no row in any
// table, so the number a waitlist lives on was unknowable.
//
// This reads events, which means it can see both halves of every step.
//
// ── Why the arithmetic is here and not in SQL ─────────────────────────────
// It is testable here. A funnel is the number a decision to change the
// product gets made on, and "trust me, the GROUP BY is right" is not good
// enough for that — particularly the cohort bucketing, which is the part
// everyone gets wrong by one week.

import type { EventName } from '@/lib/analytics/events'

/** One student's first occurrence of each event. */
export interface FirstSeen {
  studentId: string | null
  sessionId: string | null
  name: EventName
  at: string
}

export interface FunnelStep {
  name: string
  /** The event that counts as having reached this step. */
  event: EventName
  reached: number
  /** Share of the step above. Null on the first step, which has nothing to divide by. */
  ofPrevious: number | null
  /** Share of the very top, which is the number worth quoting. */
  ofStart: number | null
}

/**
 * The order somebody moves through the product.
 *
 * Two of these are deliberately not tables. `signup_started` is the step the
 * old funnel could not see at all, and `first_evidence` is the moment the
 * product first works for somebody — neither has a row that means "they got
 * here and stopped".
 */
export const FUNNEL: { name: string; event: EventName }[] = [
  { name: 'Opened signup', event: 'signup_started' },
  { name: 'Submitted it', event: 'signup_submitted' },
  // Only possible after clicking the verification link, so this is also
  // "verified their email".
  { name: 'Verified email and signed in', event: 'signin_succeeded' },
  { name: 'Onboarding 1: profile', event: 'onboarding_completed' },
  { name: 'Onboarding 2: chose goals', event: 'onboarding_intents_chosen' },
  { name: 'Onboarding 3: agreed and went to GitHub', event: 'github_connect_started' },
  { name: 'Connected GitHub', event: 'github_connected' },
  { name: 'Ran a scan', event: 'scan_started' },
  { name: 'Got a first skill', event: 'first_evidence' },
  { name: 'Applied to something', event: 'application_submitted' },
]

/**
 * Count people, not events.
 *
 * Identity is the student id once there is one and the session id before —
 * which is what lets a funnel start above the point where accounts exist.
 * It also means the top two steps count sessions and the rest count
 * students, and a session that never becomes an account is exactly the
 * thing being measured rather than a flaw in the measurement.
 */
function identify(row: FirstSeen): string | null {
  return row.studentId ?? row.sessionId ?? null
}

export function buildFunnel(rows: FirstSeen[]): FunnelStep[] {
  const reachedBy = new Map<EventName, Set<string>>()
  for (const row of rows) {
    const who = identify(row)
    if (!who) continue
    const set = reachedBy.get(row.name) ?? new Set<string>()
    set.add(who)
    reachedBy.set(row.name, set)
  }

  const start = reachedBy.get(FUNNEL[0].event)?.size ?? 0
  let previous: number | null = null

  return FUNNEL.map(({ name, event }) => {
    const reached = reachedBy.get(event)?.size ?? 0
    const step: FunnelStep = {
      name,
      event,
      reached,
      ofPrevious: previous === null || previous === 0 ? null : reached / previous,
      ofStart: start === 0 ? null : reached / start,
    }
    previous = reached
    return step
  })
}

/**
 * The step with the worst drop, which is the one to go and fix.
 *
 * Ignores steps nobody has reached yet: a step with two people above it has
 * a conversion rate that is noise, and pointing at it would send somebody to
 * rebuild a screen on the strength of one person's bad afternoon.
 */
export function worstDrop(steps: FunnelStep[], minSample = 10): FunnelStep | null {
  const candidates = steps.filter((s, i) => {
    if (i === 0 || s.ofPrevious === null) return false
    return steps[i - 1].reached >= minSample
  })
  if (candidates.length === 0) return null
  return candidates.reduce((worst, s) => (s.ofPrevious! < worst.ofPrevious! ? s : worst))
}

/**
 * Which week somebody arrived in, as an ISO date for the Monday.
 *
 * Weeks rather than months because a launch is measured in weeks, and
 * Mondays because a cohort that starts mid-week makes two adjacent weeks
 * look different for no reason.
 */
export function weekOf(iso: string): string {
  const d = new Date(iso)
  const day = (d.getUTCDay() + 6) % 7 // Monday = 0
  d.setUTCDate(d.getUTCDate() - day)
  return d.toISOString().slice(0, 10)
}

export interface Cohort {
  week: string
  size: number
  /** How many of that week's arrivals reached each later step. */
  reached: Record<string, number>
}

/**
 * How each week's arrivals did, rather than how everybody did.
 *
 * The all-time funnel hides the thing you most want to know after changing
 * something: whether this week converts better than last. A single number
 * that includes every user since launch moves too slowly to tell you.
 *
 * Somebody belongs to the week they first appeared, and is counted in a
 * later step only if they reached it at all — not only if they reached it
 * that week. A student who signs up on Friday and scans on Monday converted;
 * bucketing the scan separately would say two different people half-did.
 */
export function buildCohorts(rows: FirstSeen[], steps: EventName[]): Cohort[] {
  const firstSeenAt = new Map<string, string>()
  const reached = new Map<string, Set<EventName>>()

  for (const row of rows) {
    const who = identify(row)
    if (!who) continue
    const seen = firstSeenAt.get(who)
    if (!seen || row.at < seen) firstSeenAt.set(who, row.at)
    const set = reached.get(who) ?? new Set<EventName>()
    set.add(row.name)
    reached.set(who, set)
  }

  const byWeek = new Map<string, Cohort>()
  for (const [who, at] of Array.from(firstSeenAt.entries())) {
    const week = weekOf(at)
    const cohort = byWeek.get(week) ?? { week, size: 0, reached: {} }
    cohort.size += 1
    for (const step of steps) {
      if (reached.get(who)?.has(step)) {
        cohort.reached[step] = (cohort.reached[step] ?? 0) + 1
      }
    }
    byWeek.set(week, cohort)
  }

  return Array.from(byWeek.values()).sort((a, b) => b.week.localeCompare(a.week))
}
