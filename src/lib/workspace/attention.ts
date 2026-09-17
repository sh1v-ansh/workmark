// The two things a project stops doing when nobody is looking at it.
//
// A card waiting on a teammate is emailed once, when the verdict lands, and
// then nothing ever mentions it again. A board with no work left on it says
// nothing at all, because an empty board is only visible to somebody who
// opens the tab — and not opening the tab is the problem.
//
// Both are failures of silence rather than of logic, which is why neither
// showed up in any test: everything worked, and nobody was told.
//
// ── Why the decisions are here and the database work is not ────────────────
// Same split as membership.ts and review.ts. Deciding *whether* to speak is
// arithmetic over a few dates and can be tested exhaustively in memory;
// finding the rows and sending the mail cannot. Keeping the first part pure
// is what lets the thresholds below be argued with in a test rather than
// discovered in somebody's inbox.

/**
 * How long a review waits before the team is reminded.
 *
 * Three days rather than one. A teammate who has not answered by tomorrow is
 * usually mid-week and busy, not ignoring it, and a reminder that arrives
 * before somebody was ever going to act teaches them the reminders are noise.
 */
export const CHASE_AFTER_DAYS = 3

/**
 * How few open tasks counts as a board running dry.
 *
 * Two, not zero. Nudging at zero means telling somebody their project has
 * already stopped; nudging at two gives them the week they need to plan the
 * next piece before they run out of work.
 */
export const DRY_BOARD_TASKS = 2

/**
 * How long before a dry board is mentioned again.
 *
 * A project can be legitimately quiet — exam week, a student waiting on
 * somebody else — and a nudge every night during it is how a sender gets
 * filtered. Fortnightly is often enough to catch a project that has genuinely
 * stalled and rare enough to never be the reason somebody mutes Workmark.
 */
export const RENUDGE_AFTER_DAYS = 14

const DAY = 86_400_000

function daysBetween(from: string, to: Date): number {
  return (to.getTime() - new Date(from).getTime()) / DAY
}

export interface StaleReview {
  submissionId: string
  workspaceId: string
  taskId: string
  submittedAt: string
  /** Null when it has never been chased. */
  reviewChasedAt: string | null
}

/**
 * Which stuck reviews to mention tonight.
 *
 * Chased once, deliberately. A card that is still stuck after the reminder is
 * in the admin queue with its age showing, and staff are the backstop the
 * product actually promises — a solo student has no teammate to chase, so
 * repeating the email would nag the one person who is barred from answering.
 *
 * Anything already chased is therefore skipped forever rather than on a
 * cooldown. If that proves too quiet, the marker is a timestamp rather than a
 * boolean precisely so a second reminder can be added without a migration.
 */
export function chaseable(rows: StaleReview[], now: Date): StaleReview[] {
  return rows.filter(
    (r) => r.reviewChasedAt === null && daysBetween(r.submittedAt, now) >= CHASE_AFTER_DAYS,
  )
}

export interface BoardState {
  workspaceId: string
  /** Tasks not yet finished: anything outside verified and accepted. */
  openTasks: number
  /** Null when the board has never been nudged. */
  replanNudgedAt: string | null
  /** Null on a project with no deadline set. */
  deadline: string | null
}

/**
 * Which boards to nudge tonight.
 *
 * A project past its deadline is left alone. Running out of work is the
 * expected end state there, and "your board is nearly empty" to somebody who
 * has finished is the product failing to notice it succeeded.
 */
export function nudgeable(boards: BoardState[], now: Date): BoardState[] {
  return boards.filter((b) => {
    if (b.openTasks > DRY_BOARD_TASKS) return false
    if (b.deadline !== null && new Date(b.deadline).getTime() < now.getTime()) return false
    if (b.replanNudgedAt === null) return true
    return daysBetween(b.replanNudgedAt, now) >= RENUDGE_AFTER_DAYS
  })
}

/**
 * Group per recipient so one person gets one email.
 *
 * The rule the verdict digest already follows: a sweep that finds four stuck
 * cards on one project sends one message about four, not four messages. The
 * second shape is what makes somebody mute a sender, and then the message
 * that mattered is muted with it.
 */
export function digest<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const item of items) {
    const key = keyOf(item)
    const bucket = out.get(key)
    if (bucket) bucket.push(item)
    else out.set(key, [item])
  }
  return out
}
