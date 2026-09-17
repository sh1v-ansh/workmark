// What to work on next, as a sort rather than a judgement.
//
// ── Why this is arithmetic ────────────────────────────────────────────────
// The question "what should I do today" sounds like it needs judgement and
// does not. Something overdue beats something due Friday. A card two other
// cards are waiting on beats one nothing depends on. A card you cannot
// proceed on is not a candidate at all. There is no case where a model would
// order these differently, and one that ran per student per day would cost
// more than the rest of the product combined for an answer a comparison
// operator already has.
//
// What a model could add is how to *start* the thing — and that already
// exists, on the card, as the task thread. So there is deliberately no "ask
// Workmark what to do today" button: it would be a second, worse door to a
// feature that is already there.
//
// ── Why the reason travels with the task ──────────────────────────────────
// A ranked list with no explanation is a list people re-sort in their head
// and then ignore. "Two tasks are waiting on this" is the entire value of
// having ranked it, and it falls out of the same comparison for free.
//
// ── Why three ────────────────────────────────────────────────────────────
// Because this must not become a second board. A strip of three is a
// suggestion; a list of twelve is a competing view of the same data, and
// people end up trusting neither.

export const SHOW_TODAY = 3

export interface TodayTask {
  id: string
  title: string
  status: string
  assigneeId: string | null
  dueOn: string | null
  difficulty: number | null
  sprintId: string | null
  blockedAt: string | null
  parentTaskId: string | null
}

export interface TodayDependency {
  taskId: string
  dependsOnTaskId: string
}

export interface Ranked {
  task: TodayTask
  /** Why it is here, in the words the board shows. */
  reason: string
}

const DONE = ['verified', 'accepted']

/** Plain-date compare, never a Date. See the note in calendar work: due_on is
 *  a DATE, and parsing it into a timestamp shifts it a day west of UTC. */
function daysUntil(dueOn: string, today: string): number {
  const a = Date.UTC(+dueOn.slice(0, 4), +dueOn.slice(5, 7) - 1, +dueOn.slice(8, 10))
  const b = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10))
  return Math.round((a - b) / 86_400_000)
}

/**
 * Can this be worked on at all right now?
 *
 * Three ways to be out. Finished or set aside is obvious. Blocked means the
 * student has said they cannot proceed, and putting it top of a list of what
 * to do today would be the product ignoring something they took the trouble
 * to tell it. And a card whose dependency is unfinished is not ready however
 * urgent it looks — surfacing it produces somebody staring at work they
 * cannot start.
 *
 * Parents are excluded for the same reason they do not count anywhere else:
 * a container is not a thing you sit down and do.
 */
function actionable(
  task: TodayTask,
  byId: Map<string, TodayTask>,
  blockedBy: Map<string, string[]>,
  hasChildren: Set<string>,
): boolean {
  if (DONE.includes(task.status) || task.status === 'abandoned') return false
  if (task.status === 'submitted') return false
  if (task.blockedAt !== null) return false
  if (hasChildren.has(task.id)) return false

  const waitingOn = blockedBy.get(task.id) ?? []
  return !waitingOn.some((id) => {
    const dep = byId.get(id)
    return dep !== undefined && !DONE.includes(dep.status)
  })
}

/**
 * What to do next, best first.
 *
 * Ordered by how much it costs to leave the thing alone: something already
 * late, then something due today, then something other work is stuck behind,
 * then what was committed to this week. Work already started beats work not
 * started, because finishing beats beginning.
 */
export function rankToday(
  tasks: TodayTask[],
  dependencies: TodayDependency[],
  args: { userId: string; sprintId: string | null; today: string },
): Ranked[] {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const hasChildren = new Set(
    tasks.map((t) => t.parentTaskId).filter((id): id is string => id !== null),
  )

  const blockedBy = new Map<string, string[]>()
  const blocking = new Map<string, number>()
  for (const dep of dependencies) {
    blockedBy.set(dep.taskId, [...(blockedBy.get(dep.taskId) ?? []), dep.dependsOnTaskId])
    // Only counts if the waiting task is itself still live — being the
    // prerequisite for three finished tasks is not urgent.
    const waiter = byId.get(dep.taskId)
    if (waiter && !DONE.includes(waiter.status) && waiter.status !== 'abandoned') {
      blocking.set(dep.dependsOnTaskId, (blocking.get(dep.dependsOnTaskId) ?? 0) + 1)
    }
  }

  // Theirs, or nobody's. An unassigned card on a solo project is still their
  // work, and on a team it is work anybody could pick up.
  const mine = tasks.filter(
    (t) => (t.assigneeId === args.userId || t.assigneeId === null)
      && actionable(t, byId, blockedBy, hasChildren),
  )

  const scored = mine.map((task) => {
    const waiters = blocking.get(task.id) ?? 0
    const due = task.dueOn ? daysUntil(task.dueOn, args.today) : null

    if (due !== null && due < 0) {
      const late = -due
      return { task, rank: 0, tie: due, reason: `${late} day${late === 1 ? '' : 's'} overdue` }
    }
    if (due === 0) return { task, rank: 1, tie: 0, reason: 'Due today' }
    if (waiters > 0) {
      return {
        task, rank: 2, tie: -waiters,
        reason: `${waiters} other task${waiters === 1 ? ' is' : 's are'} waiting on this`,
      }
    }
    if (due !== null && due <= 2) {
      return { task, rank: 3, tie: due, reason: `Due in ${due} day${due === 1 ? '' : 's'}` }
    }
    if (args.sprintId && task.sprintId === args.sprintId) {
      return { task, rank: 4, tie: 0, reason: 'You committed to this for the week' }
    }
    return { task, rank: 5, tie: 0, reason: task.status === 'doing' ? 'Already started' : 'Next up' }
  })

  return scored
    .sort((a, b) =>
      a.rank - b.rank
      || a.tie - b.tie
      // Finishing beats beginning, so a card already in Doing wins a tie.
      || (b.task.status === 'doing' ? 1 : 0) - (a.task.status === 'doing' ? 1 : 0)
      || (b.task.difficulty ?? 0) - (a.task.difficulty ?? 0))
    .slice(0, SHOW_TODAY)
    .map(({ task, reason }) => ({ task, reason }))
}

/**
 * Why the list is empty, when it is.
 *
 * Four different nothings, and they need different sentences. "Nothing to do"
 * on a board where everything is blocked would be actively wrong.
 */
export function emptyReason(
  tasks: TodayTask[],
  args: { userId: string },
): string {
  const mine = tasks.filter((t) => t.assigneeId === args.userId || t.assigneeId === null)
  const live = mine.filter((t) => !DONE.includes(t.status) && t.status !== 'abandoned')

  if (mine.length === 0) return 'Nothing is assigned to you yet.'
  if (live.length === 0) return 'Everything on your plate is finished.'
  if (live.every((t) => t.status === 'submitted')) {
    return 'Everything you have is submitted and waiting to be checked.'
  }
  if (live.every((t) => t.blockedAt !== null || t.status === 'submitted')) {
    return 'Everything left is blocked. Unblocking one of them is the work.'
  }
  return 'Nothing is ready to start — the rest is waiting on other tasks.'
}
