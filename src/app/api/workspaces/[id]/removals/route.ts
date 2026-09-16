import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enforce } from '@/lib/rate-limit'
import {
  parseBody, readFields, requireString, requireUuid, ValidationError,
} from '@/lib/http/validate'

/**
 * POST /api/workspaces/[id]/removals — ask the team to remove somebody.
 *
 * `remove_workspace_member` handles the easy cases on its own: leaving, and
 * removing somebody who never contributed. It refuses the hard one and says
 * why — once a person's commits are in the ledger, taking them off the
 * project is not one person's decision. The owner here is a peer, usually a
 * fellow student, and a single click would let them erase a collaborator's
 * evidence over a falling-out.
 *
 * So it goes to a vote. The rules are already in SQL: RLS decides who may
 * open one, and `resolve_removal_request` counts a majority of the members
 * other than the person being removed. This route exists to turn a policy
 * violation into a sentence somebody can read.
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
    targetAccountId: requireUuid(parsed.body.targetAccountId, 'Who to remove'),
    // The floor is the database's. A removal with no stated reason is one the
    // person cannot argue with, and this text is what they are shown.
    reason: requireString(parsed.body.reason, 'Reason', { min: 10, max: 2000 }),
  }))
  if (!fields.ok) return fields.response
  const { targetAccountId, reason } = fields.values

  if (targetAccountId === user.id) {
    return NextResponse.json(
      { error: 'To leave a project use Leave — nobody has to vote on that.' },
      { status: 400 },
    )
  }

  // One open request per person. Two at once split the votes and neither
  // reaches a majority, which reads as the feature being broken.
  const { data: existing } = await supabase
    .from('workspace_removal_requests')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('target_account_id', targetAccountId)
    .is('resolved_at', null)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'There is already an open request about this person.' },
      { status: 409 },
    )
  }

  const { data: created, error } = await supabase
    .from('workspace_removal_requests')
    .insert({
      workspace_id: workspaceId,
      target_account_id: targetAccountId,
      requested_by: user.id,
      reason,
    })
    .select('id')
    .single()

  if (error || !created) {
    console.error('[api/workspaces/:id/removals] could not open the request:', error)
    return NextResponse.json({ error: 'Could not open that request.' }, { status: 403 })
  }

  // The opener's own vote, counted immediately. Making somebody open a
  // request and then click approve on it is a step that exists only because
  // the tables are shaped that way.
  await supabase
    .from('workspace_removal_approvals')
    .insert({ request_id: created.id, account_id: user.id })

  const { data: resolved } = await supabase.rpc('resolve_removal_request', {
    p_request: created.id,
  })

  return NextResponse.json({
    ok: true,
    id: created.id,
    // True on a two-person team, where the one other member is the whole
    // majority. Said back so the UI does not report a pending vote about
    // somebody who has already gone.
    removed: resolved === true,
  })
}
