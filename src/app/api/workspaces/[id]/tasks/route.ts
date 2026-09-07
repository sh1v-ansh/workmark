import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enforce } from '@/lib/rate-limit'
import { WORK_ROLES, type WorkRole } from '@/lib/workspace/membership'
import { positionBetween } from '@/lib/workspace/tasks'
import {
  parseBody, readFields, requireString, optionalString, optionalUuid,
  requireUuid, requireOneOf, optionalNumber, optionalInt, optionalDate, ValidationError,
} from '@/lib/http/validate'

/**
 * POST /api/workspaces/[id]/tasks — write a task.
 *
 * Anyone on the team may. A finer permission system — who may edit whose
 * task — is a thing to add when a real team asks for it, not to guess at for
 * four people who are already talking to each other.
 *
 * RLS is the actual gate: the insert policy is is_workspace_member, so
 * somebody who is not on the project gets zero rows rather than a refusal
 * they could learn something from.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const limited = await enforce('workspace', user.id)
  if (limited) return limited

  let workspaceId: string
  try {
    workspaceId = requireUuid((await params).id, 'Project')
  } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
    throw err
  }

  const parsed = await parseBody(request)
  if (!parsed.ok) return parsed.response
  const body = parsed.body

  const fields = readFields(() => ({
    title: requireString(body.title, 'A title', { min: 2, max: 200 }),
    detail: optionalString(body.detail, 'The detail', { max: 4000 }),
    acceptanceCriteria: optionalString(body.acceptanceCriteria, 'The acceptance criteria', { max: 4000 }),
    assigneeId: optionalUuid(body.assigneeId, 'Assignee'),
    sprintId: optionalUuid(body.sprintId, 'Sprint'),
    parentTaskId: optionalUuid(body.parentTaskId, 'Parent task'),
    priority: body.priority === undefined
      ? 'normal'
      : requireOneOf(body.priority, 'Priority', ['low', 'normal', 'high'] as const),
    suggestedRole: body.suggestedRole === undefined || body.suggestedRole === null || body.suggestedRole === ''
      ? null
      : requireOneOf(body.suggestedRole, 'Role', WORK_ROLES as readonly WorkRole[]),
    verifiable: body.verifiable === undefined ? true : body.verifiable === true,
    estimateHours: optionalNumber(body.estimateHours, 'Estimate', { min: 0.25, max: 200 }),
    difficulty: optionalInt(body.difficulty, 'Difficulty', { min: 1, max: 10 }),
    dueOn: optionalDate(body.dueOn, 'Due date'),
  }))
  if (!fields.ok) return fields.response
  const v = fields.values

  // New tasks land at the bottom of Backlog. Reading the current maximum
  // rather than counting rows, because positions are fractional after the
  // first drag and a count would collide.
  const { data: last } = await supabase
    .from('tasks')
    .select('position')
    .eq('workspace_id', workspaceId)
    .eq('status', 'backlog')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      workspace_id: workspaceId,
      title: v.title,
      detail: v.detail,
      acceptance_criteria: v.acceptanceCriteria,
      assignee_id: v.assigneeId,
      sprint_id: v.sprintId,
      parent_task_id: v.parentTaskId,
      priority: v.priority,
      suggested_role: v.suggestedRole,
      verifiable: v.verifiable,
      estimate_hours: v.estimateHours,
      difficulty: v.difficulty,
      due_on: v.dueOn,
      // Written by a person here. The planner sets 'ai_proposed' on the
      // tasks it drafts, and 'ai_edited' once somebody changes one — which
      // of the three a task is, is itself evidence about how the student
      // plans.
      origin: 'student_created',
      position: positionBetween((last?.position as number | undefined) ?? null, null),
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error || !task) {
    if (error?.code === '42501') {
      return NextResponse.json({ error: 'You are not on this project.' }, { status: 403 })
    }
    console.error('[api/tasks] create failed:', error)
    return NextResponse.json({ error: 'Could not create that task.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: task.id })
}
