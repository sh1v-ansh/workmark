// The board, as rules rather than as a screen.
//
// Everything here is pure so it can be tested without a database or a DOM,
// and so the API route and the UI answer the same way. The database is still
// the authority — task_transitions is trigger-written, and RLS decides who
// may touch a row at all — but a route needs to refuse a bad move with a
// sentence, and a board needs to grey out a column before anybody drags a
// card onto it.

export const BOARD_COLUMNS = [
  'backlog', 'planned', 'doing', 'submitted', 'verified', 'accepted',
] as const

export type TaskStatus = (typeof BOARD_COLUMNS)[number]

export const COLUMN_LABEL: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  planned: 'Planned',
  doing: 'Doing',
  submitted: 'Submitted',
  verified: 'Verified',
  accepted: 'Accepted',
}

/**
 * What each column means, shown once above the board rather than guessed at.
 *
 * The Submitted/Verified split is the one people get wrong, and it is the
 * whole point: a student saying the work is finished is not evidence that
 * the work actually works.
 */
export const COLUMN_HINT: Record<TaskStatus, string> = {
  backlog: 'Everything that might need doing',
  planned: 'Committed to, not started',
  doing: 'In progress right now',
  submitted: 'You think it is done — waiting to be checked',
  verified: 'Checked against your acceptance criteria',
  accepted: 'Signed off',
}

export type TaskPriority = 'low' | 'normal' | 'high'

/**
 * Which columns a person may move a card into.
 *
 * Two are missing on purpose. Nobody may drag a card into Verified: that is
 * the verifier's answer, and a board where you can mark your own work
 * verified produces evidence worth nothing. And nothing may move out of
 * Accepted — the work is closed, and reopening it would silently rewrite a
 * record something downstream has already counted.
 *
 * Everything else is allowed, including backwards. A task that turns out not
 * to be finished belongs back in Doing, and refusing that just teaches
 * people to delete the card and make a new one.
 */
export const MOVABLE_BY_PEOPLE: readonly TaskStatus[] = ['backlog', 'planned', 'doing', 'submitted']

export function canMoveTo(from: TaskStatus, to: TaskStatus): string | null {
  if (from === to) return null
  if (from === 'accepted') return 'This task is closed.'
  if (to === 'verified') return 'Workmark decides this one — submit the task and it gets checked.'
  if (to === 'accepted' && from !== 'verified') return 'A task has to be verified before it can be accepted.'
  if (!MOVABLE_BY_PEOPLE.includes(to) && to !== 'accepted') return 'You cannot move a task there.'
  return null
}

/**
 * Where a card sits within its column.
 *
 * Fractional, so dropping a card between two others is one write instead of
 * renumbering everything below it. The gap halves each time, and after about
 * fifty drops into the same slot it would run out of precision — a
 * renumbering pass would fix that, and no real board gets close.
 */
export const POSITION_STEP = 1000

export function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return POSITION_STEP
  if (before === null) return (after as number) - POSITION_STEP
  if (after === null) return before + POSITION_STEP
  return (before + after) / 2
}

/** Sort for one column: position, then oldest first as a stable tiebreak. */
export function byBoardOrder<T extends { position: number; createdAt: string | null }>(a: T, b: T): number {
  if (a.position !== b.position) return a.position - b.position
  return (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
}

/**
 * The plan fields, and which of them are worth a reason when they change.
 *
 * An estimate or a deadline moving is the single most informative thing that
 * happens on this board — it is the difference between "missed it" and "saw
 * it coming and renegotiated". Asking why costs the student one sentence and
 * is the only way that distinction ever gets recorded.
 *
 * Everything else changes silently. A prompt on every edit is a prompt
 * people learn to dismiss, and then the ones that matter get dismissed too.
 */
export const REVISION_FIELDS = [
  'title', 'acceptance_criteria', 'estimate_hours', 'difficulty',
  'due_on', 'assignee_id', 'sprint_id', 'priority',
] as const

export type RevisionField = (typeof REVISION_FIELDS)[number]

export const REASON_WORTH_ASKING: readonly RevisionField[] = ['estimate_hours', 'due_on']

export function wantsReason(field: RevisionField): boolean {
  return REASON_WORTH_ASKING.includes(field)
}

/**
 * What actually changed, as revision rows.
 *
 * Compares the patch against the row it is being applied to, so a field
 * submitted unchanged — which a form does on every save — does not become a
 * revision. A history full of "estimate: 4 → 4" is a history nobody reads.
 */
export function revisionsFor(
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
): { field: RevisionField; oldValue: string | null; newValue: string | null }[] {
  const out: { field: RevisionField; oldValue: string | null; newValue: string | null }[] = []
  for (const field of REVISION_FIELDS) {
    if (!(field in patch)) continue
    const before = current[field] ?? null
    const after = patch[field] ?? null
    if (String(before ?? '') === String(after ?? '')) continue
    out.push({
      field,
      oldValue: before === null ? null : String(before),
      newValue: after === null ? null : String(after),
    })
  }
  return out
}

/**
 * How long a task actually took, from the board rather than from the person.
 *
 * Sums every stretch spent in Doing, so a task picked up, put down and picked
 * up again counts the work and not the gap. Nobody is ever asked, which is
 * the only reason this number is worth anything.
 */
export function hoursInDoing(
  transitions: { to_status: string; occurred_at: string }[],
  now: Date = new Date(),
): number {
  const ordered = [...transitions].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
  let total = 0
  let enteredAt: number | null = null

  for (const t of ordered) {
    const at = new Date(t.occurred_at).getTime()
    if (Number.isNaN(at)) continue
    if (t.to_status === 'doing') {
      if (enteredAt === null) enteredAt = at
    } else if (enteredAt !== null) {
      total += at - enteredAt
      enteredAt = null
    }
  }
  // Still in Doing: count up to now, so a card left open reads as growing
  // rather than as zero.
  if (enteredAt !== null) total += now.getTime() - enteredAt

  return Math.round((total / 3_600_000) * 100) / 100
}

/** How far off the estimate was. Positive means it took longer than planned. */
export function estimateError(estimateHours: number | null, actualHours: number): number | null {
  if (estimateHours === null || estimateHours <= 0) return null
  return Math.round(((actualHours - estimateHours) / estimateHours) * 100) / 100
}
