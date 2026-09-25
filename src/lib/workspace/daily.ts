import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Daily tasks: the internship pace.
 *
 * The plan is drafted whole, but on a daily pace the student sees one day's
 * work at a time. Every morning at 8:00 in their timezone the next batch
 * moves from the backlog into Planned, due that day, and they get an email.
 * The rest of the plan stays out of sight until its day comes.
 *
 * No model call. The plan's order, its dependencies and each task's
 * estimate decide the batch.
 */

/** Hours of work in a normal day's batch. A student, not a full-time job. */
export const DAILY_HOURS = 3
/** Never more than this many tasks in one batch. */
export const MAX_PER_BATCH = 3
/** No new batch while this many released tasks are still unfinished. */
export const MAX_UNFINISHED = 4
/** Local hour the batch goes out. */
export const BATCH_HOUR = 8

const FINISHED = new Set(['verified', 'accepted', 'abandoned'])
const IN_FLIGHT = new Set(['planned', 'doing', 'submitted'])

export interface BatchTask {
  id: string
  status: string
  position: number
  estimateHours: number | null
  ticketKind: string | null
}

/**
 * The next day's tasks, in plan order. Pure, for tests.
 *
 * A task is ready when everything it depends on is finished, already out
 * with the student, or earlier in this same batch: a chain of dependent
 * tasks would otherwise trickle out one a day.
 */
export function pickDailyBatch(tasks: BatchTask[], dependsOn: Map<string, string[]>): string[] {
  const unfinished = tasks.filter((t) => IN_FLIGHT.has(t.status)).length
  let room = Math.min(MAX_PER_BATCH, MAX_UNFINISHED - unfinished)
  if (room <= 0) return []

  const byId = new Map(tasks.map((t) => [t.id, t]))
  const picked: string[] = []
  let hours = 0

  const backlog = tasks
    .filter((t) => t.status === 'backlog')
    .sort((a, b) => (a.ticketKind === 'ramp_up' ? -1 : b.ticketKind === 'ramp_up' ? 1 : a.position - b.position))

  for (const task of backlog) {
    if (room <= 0 || hours >= DAILY_HOURS) break
    const ready = (dependsOn.get(task.id) ?? []).every((dep) => {
      const d = byId.get(dep)
      return !d || FINISHED.has(d.status) || IN_FLIGHT.has(d.status) || picked.includes(dep)
    })
    if (!ready) continue
    picked.push(task.id)
    hours += task.estimateHours ?? 2
    room--
  }
  return picked
}

/** Today's date and hour in a timezone, falling back to UTC for a bad one. */
export function localNow(timezone: string | null, now = new Date()): { date: string; hour: number } {
  const zone = validTimezone(timezone) ?? 'UTC'
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) }
}

export function validTimezone(tz: unknown): string | null {
  if (typeof tz !== 'string' || tz.length > 64) return null
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return tz
  } catch {
    return null
  }
}

/**
 * Move the next batch into Planned, due today, and record that today's batch
 * went out. Returns the released task ids. Service role: runs from cron.
 */
export async function releaseDailyBatch(
  admin: SupabaseClient,
  workspaceId: string,
  localDate: string,
): Promise<{ id: string; title: string; assigneeId: string | null }[]> {
  const { data: rows } = await admin
    .from('tasks')
    .select('id, title, status, position, estimate_hours, ticket_kind, parent_task_id, assignee_id')
    .eq('workspace_id', workspaceId)
  const top = (rows ?? []).filter((t) => !t.parent_task_id)
  const tasks: BatchTask[] = top.map((t) => ({
    id: t.id, status: t.status, position: Number(t.position) || 0,
    estimateHours: t.estimate_hours === null ? null : Number(t.estimate_hours), ticketKind: t.ticket_kind,
  }))

  const { data: depRows } = tasks.length
    ? await admin.from('task_dependencies').select('task_id, depends_on_id').in('task_id', tasks.map((t) => t.id))
    : { data: [] as { task_id: string; depends_on_id: string }[] }
  const dependsOn = new Map<string, string[]>()
  for (const d of depRows ?? []) dependsOn.set(d.task_id, [...(dependsOn.get(d.task_id) ?? []), d.depends_on_id])

  const ids = pickDailyBatch(tasks, dependsOn)
  const now = new Date().toISOString()
  const released: { id: string; title: string; assigneeId: string | null }[] = []
  for (const id of ids) {
    // Guarded on status, so a card somebody already dragged out stays put.
    const { data, error } = await admin
      .from('tasks')
      .update({ status: 'planned', released_at: now, release_note: 'Today’s task.', due_on: localDate })
      .eq('id', id)
      .eq('status', 'backlog')
      .select('id')
    if (error) console.error('[daily] release failed', { workspaceId, id, error })
    else if (data && data.length > 0) {
      const row = top.find((t) => t.id === id)!
      released.push({ id, title: row.title as string, assigneeId: (row.assignee_id as string | null) ?? null })
    }
  }

  await admin.from('workspaces').update({ last_batch_on: localDate }).eq('id', workspaceId)
  return released
}
