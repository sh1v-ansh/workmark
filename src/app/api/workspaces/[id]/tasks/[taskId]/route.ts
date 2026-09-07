import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enforce } from '@/lib/rate-limit'
import { WORK_ROLES, type WorkRole } from '@/lib/workspace/membership'
import { canMoveTo, revisionsFor, type TaskStatus, BOARD_COLUMNS } from '@/lib/workspace/tasks'
import {
  parseBody, readFields, requireString, optionalString, optionalUuid,
  requireUuid, requireOneOf, optionalNumber, optionalInt, optionalDate, ValidationError,
} from '@/lib/http/validate'

interface Params { params: Promise<{ id: string; taskId: string }> }

async function ids(params: Params['params']) {
  const raw = await params
  return { workspaceId: requireUuid(raw.id, 'Project'), taskId: requireUuid(raw.taskId, 'Task') }
}

/**
 * PATCH — edit a task, move it, or flag it blocked.
 *
 * One route, because they are all "change this row" and a board sends them
 * interchangeably: dropping a card is a status change, and the edit dialog
 * saves six fields at once.
 *
 * Two things happen here that do not happen in an ordinary update.
 *
 * A move is checked against canMoveTo before it is attempted. Nobody may
 * drag a card into Verified — that is the verifier's answer, and a board
 * where you can mark your own work verified produces evidence worth nothing.
 *
 * A change to the plan writes a task_revisions row. That is the whole reason
 * this feature is worth building: an estimate edited in place destroys the
 * fact that it was ever different, and "saw the slip coming and renegotiated"
 * is more informative than any deadline that was hit.
 *
 * task_transitions is NOT written here. A trigger does it, because
 * time-in-column is the basis of estimate-versus-actual and a caller that
 * forgets to log a move — or shades one — would corrupt the only honest
 * measurement in the product.
 */
export async function PATCH(request: Request, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const limited = await enforce('workspace', user.id)
  if (limited) return limited

  let workspaceId: string, taskId: string
  try { ({ workspaceId, taskId } = await ids(params)) } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
    throw err
  }

  const parsed = await parseBody(request)
  if (!parsed.ok) return parsed.response
  const body = parsed.body

  // Read through the caller's own session first: RLS means a task they
  // cannot see is one they cannot touch, and it comes back as not-found
  // rather than as a refusal that confirms it exists.
  const { data: current } = await supabase
    .from('tasks')
    .select('id, status, title, acceptance_criteria, estimate_hours, difficulty, due_on, assignee_id, sprint_id, priority')
    .eq('id', taskId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (!current) return NextResponse.json({ error: 'Task not found.' }, { status: 404 })

  const patch: Record<string, unknown> = {}

  const fields = readFields(() => {
    if (body.title !== undefined) patch.title = requireString(body.title, 'A title', { min: 2, max: 200 })
    if (body.detail !== undefined) patch.detail = optionalString(body.detail, 'The detail', { max: 4000 })
    if (body.acceptanceCriteria !== undefined) {
      patch.acceptance_criteria = optionalString(body.acceptanceCriteria, 'The acceptance criteria', { max: 4000 })
    }
    if (body.assigneeId !== undefined) patch.assignee_id = optionalUuid(body.assigneeId, 'Assignee')
    if (body.sprintId !== undefined) patch.sprint_id = optionalUuid(body.sprintId, 'Sprint')
    if (body.priority !== undefined) {
      patch.priority = requireOneOf(body.priority, 'Priority', ['low', 'normal', 'high'] as const)
    }
    if (body.suggestedRole !== undefined) {
      patch.suggested_role = body.suggestedRole === null || body.suggestedRole === ''
        ? null
        : requireOneOf(body.suggestedRole, 'Role', WORK_ROLES as readonly WorkRole[])
    }
    if (body.estimateHours !== undefined) {
      patch.estimate_hours = optionalNumber(body.estimateHours, 'Estimate', { min: 0.25, max: 200 })
    }
    if (body.difficulty !== undefined) {
      patch.difficulty = optionalInt(body.difficulty, 'Difficulty', { min: 1, max: 10 })
    }
    if (body.dueOn !== undefined) patch.due_on = optionalDate(body.dueOn, 'Due date')
    if (body.verifiable !== undefined) patch.verifiable = body.verifiable === true
    if (body.position !== undefined) {
      patch.position = optionalNumber(body.position, 'Position', { min: -1e9, max: 1e9 })
    }

    if (body.status !== undefined) {
      patch.status = requireOneOf(body.status, 'Status', BOARD_COLUMNS)
    }

    // Blocked is a flag, not a column. A blocked task is still in Doing, and
    // moving it elsewhere would lose where the work actually was.
    if (body.blocked !== undefined) {
      if (body.blocked === true) {
        patch.blocked_reason = requireString(body.blockedReason, 'A reason', { min: 3, max: 1000 })
        patch.blocked_at = new Date().toISOString()
      } else {
        patch.blocked_at = null
        patch.blocked_reason = null
      }
    }

    return optionalString(body.reason, 'Reason', { max: 1000 })
  })
  if (!fields.ok) return fields.response
  const reason = fields.values

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 })
  }

  if (patch.status) {
    const refusal = canMoveTo(current.status as TaskStatus, patch.status as TaskStatus)
    if (refusal) return NextResponse.json({ error: refusal }, { status: 400 })
  }

  const { data: updated, error } = await supabase
    .from('tasks')
    .update(patch)
    .eq('id', taskId)
    .eq('workspace_id', workspaceId)
    .select('id, status')

  if (error) {
    console.error('[api/tasks/:id] update failed:', error)
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: 'You are not on this project.' }, { status: 403 })
  }

  // After the update, not before: a revision that records a change which
  // then failed would be a history of something that never happened.
  const revisions = revisionsFor(current as Record<string, unknown>, patch)
  if (revisions.length > 0) {
    const { error: revisionError } = await supabase.from('task_revisions').insert(
      revisions.map((r) => ({
        workspace_id: workspaceId,
        task_id: taskId,
        field: r.field,
        old_value: r.oldValue,
        new_value: r.newValue,
        reason,
        changed_by: user.id,
      })),
    )
    // Logged, not surfaced. The edit succeeded; losing its footnote is not
    // worth telling somebody their save failed when it did not.
    if (revisionError) console.error('[api/tasks/:id] revision insert failed:', revisionError)
  }

  return NextResponse.json({ ok: true, status: updated[0].status })
}

/**
 * DELETE — remove a task.
 *
 * Only from the two columns where nothing has been claimed yet. Once work
 * has started the card is part of the record: a task abandoned halfway is a
 * fact about how the project went, and deleting it is how a board becomes a
 * highlight reel. Those move to Backlog instead.
 */
export async function DELETE(_request: Request, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  let workspaceId: string, taskId: string
  try { ({ workspaceId, taskId } = await ids(params)) } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
    throw err
  }

  const { data: task } = await supabase
    .from('tasks')
    .select('id, status')
    .eq('id', taskId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (!task) return NextResponse.json({ error: 'Task not found.' }, { status: 404 })

  if (!['backlog', 'planned'].includes(task.status as string)) {
    return NextResponse.json(
      { error: 'This task has been started, so it stays on the record. Move it back to Backlog instead.' },
      { status: 400 },
    )
  }

  const { error } = await supabase.from('tasks').delete().eq('id', taskId).eq('workspace_id', workspaceId)
  if (error) {
    console.error('[api/tasks/:id] delete failed:', error)
    return NextResponse.json({ error: 'Could not delete that.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
