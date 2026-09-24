import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { enforce } from '@/lib/rate-limit'
import {
  parseBody, readFields, requireString, optionalString, requireUuid, requireOneOf, ValidationError,
} from '@/lib/http/validate'

/**
 * PATCH /api/workspaces/[id] — edit a project, or start it.
 *
 * Only owners get here. RLS enforces that independently: the update policy
 * on workspaces is is_workspace_owner(id), so a member who reached this route
 * would change zero rows rather than be told no. The check below exists to
 * give them a sentence instead of a silent no-op.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const limited = await enforce('workspace', user.id)
  if (limited) return limited

  let id: string
  try {
    id = requireUuid((await params).id, 'Project')
  } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
    throw err
  }

  const parsed = await parseBody(request)
  if (!parsed.ok) return parsed.response
  const body = parsed.body

  const patch: Record<string, unknown> = {}
  const fields = readFields(() => {
    if (body.title !== undefined) patch.title = requireString(body.title, 'A project name', { min: 3, max: 120 })
    if (body.summary !== undefined) patch.summary = optionalString(body.summary, 'The summary', { max: 2000 })
    if (body.deadline !== undefined) {
      const value = optionalString(body.deadline, 'The deadline', { max: 10 })
      if (value !== null && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new ValidationError('That deadline is not a valid date.')
      }
      patch.deadline = value
    }
    if (body.status !== undefined) {
      patch.status = requireOneOf(body.status, 'Status', ['active', 'submitted', 'closed', 'abandoned'] as const)
    }
    return null
  })
  if (!fields.ok) return fields.response

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 })
  }

  const { data: updated, error } = await supabase
    .from('workspaces')
    .update(patch)
    .eq('id', id)
    .select('id, status')

  if (error) {
    // 23514 is the check violation raised by require_repo_before_starting.
    // Its message is written for the person reading it, so it is passed
    // through rather than replaced with something vaguer.
    if (error.code === '23514' || error.message.includes('GitHub repository')) {
      return NextResponse.json(
        { error: 'Attach a GitHub repository before starting the project.' },
        { status: 400 },
      )
    }
    console.error('[api/workspaces/:id] update failed:', error)
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
  }

  // Zero rows means RLS declined: not an owner, or not on the project at
  // all. Both are the same answer to the person asking.
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: 'Only an owner can change this project.' }, { status: 403 })
  }

  return NextResponse.json({ ok: true, status: updated[0].status })
}

/**
 * DELETE /api/workspaces/[id] — delete a solo project.
 *
 * Only when you own it, nobody else is on it (or invited), and it has not
 * been closed — a closed project's result is on your record, and a team
 * project is other people's work too. Everything under it cascades.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const limited = await enforce('workspace', user.id)
  if (limited) return limited

  let id: string
  try {
    id = requireUuid((await params).id, 'Project')
  } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
    throw err
  }

  const [{ data: workspace }, { data: members }] = await Promise.all([
    supabase.from('workspaces').select('id, status').eq('id', id).maybeSingle(),
    supabase.from('workspace_members').select('account_id, role').eq('workspace_id', id).is('removed_at', null),
  ])
  const mine = (members ?? []).find((m) => m.account_id === user.id)
  if (!workspace || mine?.role !== 'owner') {
    return NextResponse.json({ error: 'Only the owner can delete this project.' }, { status: 404 })
  }
  if ((members ?? []).length > 1) {
    return NextResponse.json({ error: 'Other people are on this project, so it can be closed but not deleted.' }, { status: 409 })
  }
  if (workspace.status === 'closed') {
    return NextResponse.json({ error: 'A finished project is part of your record and cannot be deleted.' }, { status: 409 })
  }

  // Checked above as the caller; deleted with the service role because
  // workspaces has no delete policy.
  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { error } = await admin.from('workspaces').delete().eq('id', id)
  if (error) {
    console.error('[api/workspaces/id] delete failed:', error)
    return NextResponse.json({ error: 'Could not delete the project.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
