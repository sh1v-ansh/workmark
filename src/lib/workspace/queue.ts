import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The ticket queue.
 *
 * The planner drafts the whole plan and its order is an argument worth
 * keeping — schema before the endpoints that read it. What changed is how
 * much of it lands in front of somebody at once. Twelve tasks on day one is
 * a mountain; one or two is a job. So tasks wait in the backlog and the
 * queue releases them into Planned as earlier ones are finished, each with
 * one line saying why it is next.
 *
 * Nothing here is enforced. The board stays open and anybody can drag a card
 * out of the backlog early — it is a job, not a cage. The queue only decides
 * what arrives on its own.
 *
 * No model call: the plan's order, its dependency graph and each task's
 * difficulty already say everything the choice needs.
 */

/** Tickets in flight per person before the queue stops releasing. Two, so
 *  there is always something to switch to when one is stuck on a review. */
export const WIP_PER_PERSON = 2

const FINISHED = new Set(['verified', 'accepted', 'abandoned'])
const IN_FLIGHT = new Set(['planned', 'doing', 'submitted'])

export interface QueueTask {
  id: string
  title: string
  status: string
  position: number
  difficulty: number | null
  ticketKind: string | null
}

export interface Release {
  taskId: string
  note: string
}

/**
 * Which backlog tasks to release, and why. Pure, so it can be tested
 * without a database.
 *
 * @param justFinished the task whose completion prompted this, if any —
 *   it is what lets the note say "builds on what you just finished".
 */
export function ticketsToRelease(
  tasks: QueueTask[],
  dependsOn: Map<string, string[]>,
  capacity: number,
  justFinished: QueueTask | null,
): Release[] {
  const byId = new Map(tasks.map((t) => [t.id, t]))

  // Day one comes first and comes alone. Until the ramp-up ticket is done,
  // nothing else is released: it is what proves the repository and the scan
  // work, and a week of real work on a broken link is the thing to avoid.
  const rampUp = tasks.find((t) => t.ticketKind === 'ramp_up')
  if (rampUp && !FINISHED.has(rampUp.status)) {
    return rampUp.status === 'backlog'
      ? [{ taskId: rampUp.id, note: 'Day one: get it running and push one change. Every job starts here.' }]
      : []
  }

  const inFlight = tasks.filter((t) => IN_FLIGHT.has(t.status)).length
  let room = capacity - inFlight
  if (room <= 0) return []

  const ready = tasks
    .filter((t) => t.status === 'backlog')
    .filter((t) => (dependsOn.get(t.id) ?? []).every((dep) => {
      const d = byId.get(dep)
      // A dependency that no longer exists does not block anything.
      return !d || FINISHED.has(d.status)
    }))

  // What builds directly on the thing just finished goes first: momentum is
  // worth more than strict plan order, and the reason is easy to say.
  const unlocked = justFinished
    ? ready.filter((t) => (dependsOn.get(t.id) ?? []).includes(justFinished.id))
    : []
  const rest = ready.filter((t) => !unlocked.includes(t))
  unlocked.sort((a, b) => a.position - b.position)
  rest.sort((a, b) => a.position - b.position)

  const releases: Release[] = []
  for (const task of [...unlocked, ...rest]) {
    if (room <= 0) break
    releases.push({ taskId: task.id, note: noteFor(task, justFinished, unlocked.includes(task), releases.length === 0 && !justFinished && inFlight === 0) })
    room--
  }
  return releases
}

function noteFor(task: QueueTask, justFinished: QueueTask | null, buildsOnIt: boolean, isFirst: boolean): string {
  if (buildsOnIt && justFinished) return `Builds on “${justFinished.title}”, which you just finished.`
  if (isFirst) return 'Your first ticket from the plan.'
  if (justFinished?.difficulty != null && task.difficulty != null && task.difficulty > justFinished.difficulty) {
    return 'A step up from the last one — you handled that, so this is next.'
  }
  return 'Next in the plan.'
}

/**
 * Release whatever is due for one project, and write it down.
 *
 * Service-role client: this runs after a verification, which may be a
 * background job with no student session. Safe to call any time — with
 * nothing due it reads two small result sets and writes nothing.
 */
export async function releaseTickets(
  admin: SupabaseClient,
  workspaceId: string,
  justFinishedId: string | null = null,
): Promise<Release[]> {
  const [{ data: taskRows }, { data: memberRows }] = await Promise.all([
    admin
      .from('tasks')
      .select('id, title, status, position, difficulty, ticket_kind, parent_task_id')
      .eq('workspace_id', workspaceId),
    admin
      .from('workspace_members')
      .select('account_id')
      .eq('workspace_id', workspaceId)
      .not('accepted_at', 'is', null)
      .is('removed_at', null),
  ])
  // Subtasks belong to their parent's card, not the queue.
  const rows = (taskRows ?? []).filter((t) => !t.parent_task_id)
  if (rows.length === 0) return []

  const tasks: QueueTask[] = rows.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    position: Number(t.position) || 0,
    difficulty: t.difficulty,
    ticketKind: t.ticket_kind,
  }))

  const { data: depRows } = await admin
    .from('task_dependencies')
    .select('task_id, depends_on_id')
    .in('task_id', tasks.map((t) => t.id))
  const dependsOn = new Map<string, string[]>()
  for (const d of depRows ?? []) {
    const list = dependsOn.get(d.task_id) ?? []
    list.push(d.depends_on_id)
    dependsOn.set(d.task_id, list)
  }

  const people = Math.max(1, (memberRows ?? []).length)
  const justFinished = justFinishedId ? tasks.find((t) => t.id === justFinishedId) ?? null : null
  const releases = ticketsToRelease(tasks, dependsOn, people * WIP_PER_PERSON, justFinished)

  const now = new Date().toISOString()
  for (const r of releases) {
    // Guarded on status so a card somebody dragged in the meantime is left
    // exactly where they put it.
    const { error } = await admin
      .from('tasks')
      .update({ status: 'planned', released_at: now, release_note: r.note })
      .eq('id', r.taskId)
      .eq('status', 'backlog')
    if (error) console.error('[queue] release failed', { workspaceId, taskId: r.taskId, error })
  }
  return releases
}

/** The day-one ticket. Written here rather than by the planner so it is the
 *  same every time and costs nothing. */
export const RAMP_UP_TICKET = {
  title: 'Day one: get it running',
  detail: [
    'Every job starts the same way. Before the real work:',
    '1. Clone the repository and get it running on your machine.',
    '2. Make one small change you can see — the README, a heading, a colour.',
    '3. Commit it and push to the default branch.',
    '',
    'Deliberately small. It proves your setup, the repository link and the scan all work before you spend a week on the real thing.',
  ].join('\n'),
  acceptanceCriteria: 'A commit of yours on the linked repository that makes a visible change, pushed to the default branch.',
  estimateHours: 1,
  difficulty: 1,
} as const
