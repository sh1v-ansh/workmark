// Breaking a task down, and the one rule that stops it inflating a record.
//
// ── Why this is not just a nullable column ────────────────────────────────
// `tasks.parent_task_id` has existed since v05_0027 and nothing wrote to it,
// which was the safe state: the moment a card can have children, every count
// in the product is wrong unless somebody decides what a parent is.
//
// A parent with children is a container, not work. Counting both means a task
// broken into three gets four times the credit — in the evidence minted at
// close, in the metrics on somebody's record, and in a week's progress. Same
// work, four times the number, and the student who decomposed carefully is
// rewarded over the one who did not. That is the failure this module exists
// to prevent, and the rule is one line: only leaves count.
//
// ── What a subtask is actually worth measuring ────────────────────────────
// Not how many there are. WHEN they appeared. A task broken up before it was
// started is planning; one broken up on day three is discovery, and the
// second is the more interesting fact — it is somebody finding out the shape
// of a problem by hitting it. Both are recorded, neither is scored, and
// `decomposedAt` below is what tells them apart.
//
// Pure, so the board, the API and every count agree.

export interface SubtaskNode {
  id: string
  parentTaskId: string | null
  status: string
  /** When the card was created. Compared against the parent's start. */
  createdAt: string | null
  /** First entry into Doing, on the parent. */
  startedAt: string | null
}

/**
 * Only one level, and the API enforces it.
 *
 * A tree is a project plan, and a project plan is a thing nobody maintains
 * past week two. One level is a checklist, which people do keep up.
 */
export function canAddSubtask(parent: Pick<SubtaskNode, 'parentTaskId' | 'status'>): string | null {
  if (parent.parentTaskId !== null) {
    return 'This is already a subtask. Break the work up one level, not two.'
  }
  if (parent.status === 'accepted') return 'This task is closed.'
  if (parent.status === 'abandoned') return 'This task was set aside. Pick it back up first.'
  return null
}

export function childrenOf(tasks: SubtaskNode[], parentId: string): SubtaskNode[] {
  return tasks.filter((t) => t.parentTaskId === parentId)
}

export function hasChildren(tasks: SubtaskNode[], id: string): boolean {
  return tasks.some((t) => t.parentTaskId === id)
}

/**
 * The tasks that count, for every count in the product.
 *
 * A card with no children is work. A card with children is a heading over
 * work that is counted separately. Excluding parents rather than children is
 * what keeps the total equal to the amount of work actually done.
 */
export function countable<T extends SubtaskNode>(tasks: T[]): T[] {
  const parents = new Set(tasks.map((t) => t.parentTaskId).filter((id): id is string => id !== null))
  return tasks.filter((t) => !parents.has(t.id))
}

const DONE = ['verified', 'accepted']

/**
 * May this parent be submitted?
 *
 * Not while its children are still open. A parent moved to Submitted with two
 * subtasks in Doing is a claim that the work is finished alongside a board
 * that says it is not, and the checker would be asked to verify something
 * nobody has claimed to have done yet.
 *
 * Set-aside children do not block: deciding a piece is not happening is an
 * answer, and the parent can close around it.
 */
export function canSubmitParent(tasks: SubtaskNode[], parentId: string): string | null {
  const open = childrenOf(tasks, parentId).filter(
    (c) => !DONE.includes(c.status) && c.status !== 'abandoned',
  )
  if (open.length === 0) return null
  return `${open.length} subtask${open.length === 1 ? '' : 's'} still open. Finish or set ${open.length === 1 ? 'it' : 'them'} aside first.`
}

/**
 * How far through a parent's children the work is.
 *
 * Shown on the card so a parent does not look untouched while three of its
 * four pieces are done. Null when there are no children, which is most cards.
 */
export function childProgress(tasks: SubtaskNode[], parentId: string): { done: number; total: number } | null {
  const children = childrenOf(tasks, parentId)
  if (children.length === 0) return null
  return {
    done: children.filter((c) => DONE.includes(c.status)).length,
    total: children.length,
  }
}

export type Decomposition = 'planned' | 'discovered'

/**
 * Was this broken up before starting, or while stuck?
 *
 * The interesting half of subtasks. A student who splits a task before
 * touching it has read the problem; one who splits it on day three has found
 * out what the problem actually was, which is a different and arguably better
 * thing to have done.
 *
 * Null when the parent was never started — there is nothing to be before or
 * after, and guessing would make the figure meaningless.
 */
export function decomposedAt(parent: SubtaskNode, child: SubtaskNode): Decomposition | null {
  if (!parent.startedAt || !child.createdAt) return null
  return new Date(child.createdAt) <= new Date(parent.startedAt) ? 'planned' : 'discovered'
}
