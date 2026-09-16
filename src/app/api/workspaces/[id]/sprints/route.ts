import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enforce } from '@/lib/rate-limit'
import {
  parseBody, readFields, optionalString, requireUuid, ValidationError,
} from '@/lib/http/validate'
import { nextDates, nextName, toSprint, type Sprint } from '@/lib/workspace/sprint'

/**
 * POST /api/workspaces/[id]/sprints — start a week.
 *
 * A sprint is the only place in Workmark where somebody commits to an amount
 * of work before doing it and is then shown what actually happened. That gap
 * is the most informative thing this product records, and until now the table
 * holding it had never been written to.
 *
 * The dates and the name are computed rather than asked for. A student
 * starting a week does not want a form with two date pickers and a text
 * field; they want the week to start. Both are in sprint.ts and the goal is
 * the one thing worth typing.
 *
 * Only one open sprint per project, enforced by a partial unique index rather
 * than here — the API is one of several ways a row could arrive.
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

  const fields = readFields(() => ({
    goal: optionalString(parsed.body.goal, 'Goal', { max: 500 }),
  }))
  if (!fields.ok) return fields.response

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('status')
    .eq('id', workspaceId)
    .maybeSingle()

  if (!workspace) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
  if (workspace.status !== 'active') {
    return NextResponse.json(
      { error: 'Start the project before planning a week on it.' },
      { status: 400 },
    )
  }

  const { data: existing } = await supabase
    .from('sprints')
    .select('id, name, goal, starts_on, ends_on, closed_at, retro')
    .eq('workspace_id', workspaceId)

  const sprints: Sprint[] = (existing ?? []).map(toSprint)
  if (sprints.some((s) => s.closedAt === null)) {
    return NextResponse.json(
      { error: 'There is already a week running. Review it before starting the next one.' },
      { status: 409 },
    )
  }

  const { startsOn, endsOn } = nextDates(new Date())
  const { data: created, error } = await supabase
    .from('sprints')
    .insert({
      workspace_id: workspaceId,
      name: nextName(sprints),
      goal: fields.values.goal,
      starts_on: startsOn,
      ends_on: endsOn,
    })
    .select('id, name, goal, starts_on, ends_on, closed_at, retro')
    .single()

  if (error || !created) {
    // The partial unique index is the real guard, and it fires here if two
    // people press the button at the same moment. Same sentence either way.
    console.error('[api/workspaces/:id/sprints] could not start a sprint:', error)
    return NextResponse.json(
      { error: 'Could not start a week. There may already be one running.' },
      { status: 409 },
    )
  }

  return NextResponse.json({ ok: true, sprint: toSprint(created) })
}
