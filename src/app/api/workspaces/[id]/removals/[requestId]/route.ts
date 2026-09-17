import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enforce } from '@/lib/rate-limit'
import { requireUuid, ValidationError } from '@/lib/http/validate'

async function ids(params: Promise<{ id: string; requestId: string }>) {
  const raw = await params
  return {
    workspaceId: requireUuid(raw.id, 'Project'),
    requestId: requireUuid(raw.requestId, 'Request'),
  }
}

/**
 * POST — agree that this person should go.
 *
 * The vote itself is one row, and `resolve_removal_request` decides whether
 * that row was the one that tipped it. Deliberately no unvoting: a removal
 * that can be withdrawn after it has taken effect is a second, quieter way
 * to argue about the same thing, and the person is already gone by then.
 * Somebody who changes their mind before the majority lands has the opener
 * withdraw the request instead.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string; requestId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const limited = await enforce('workspace', user.id)
  if (limited) return limited

  let workspaceId: string, requestId: string
  try {
    ({ workspaceId, requestId } = await ids(params))
  } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
    throw err
  }

  // Read through the caller's session, so a request on a project they are not
  // on is invisible rather than refused — the same shape every other route
  // here uses, and it does not confirm the id exists.
  const { data: removal } = await supabase
    .from('workspace_removal_requests')
    .select('id, target_account_id, resolved_at')
    .eq('id', requestId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (!removal) return NextResponse.json({ error: 'Request not found.' }, { status: 404 })
  if (removal.resolved_at) {
    return NextResponse.json({ error: 'That request is already settled.' }, { status: 400 })
  }
  if (removal.target_account_id === user.id) {
    return NextResponse.json(
      { error: 'You cannot vote on your own removal.' },
      { status: 403 },
    )
  }

  // Unique on (request_id, account_id), so a double click is a no-op rather
  // than a second vote.
  const { error } = await supabase
    .from('workspace_removal_approvals')
    .upsert(
      { request_id: requestId, account_id: user.id },
      { onConflict: 'request_id,account_id', ignoreDuplicates: true },
    )

  if (error) {
    console.error('[api/workspaces/:id/removals/:requestId] could not record the vote:', error)
    return NextResponse.json({ error: 'Could not record that.' }, { status: 403 })
  }

  const { data: resolved } = await supabase.rpc('resolve_removal_request', {
    p_request: requestId,
  })

  return NextResponse.json({ ok: true, removed: resolved === true })
}

/**
 * DELETE — withdraw the request.
 *
 * Only the person who opened it, and only while it is still open. Anyone
 * being able to close somebody else's request would make it a race rather
 * than a vote.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; requestId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  let workspaceId: string, requestId: string
  try {
    ({ workspaceId, requestId } = await ids(params))
  } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
    throw err
  }

  const { data: removal } = await supabase
    .from('workspace_removal_requests')
    .select('id, requested_by, resolved_at')
    .eq('id', requestId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (!removal) return NextResponse.json({ error: 'Request not found.' }, { status: 404 })
  if (removal.resolved_at) {
    return NextResponse.json({ error: 'That request is already settled.' }, { status: 400 })
  }
  if (removal.requested_by !== user.id) {
    return NextResponse.json(
      { error: 'Only whoever opened this can withdraw it.' },
      { status: 403 },
    )
  }

  const { error } = await supabase
    .from('workspace_removal_requests')
    .update({ resolved_at: new Date().toISOString(), outcome: 'withdrawn' })
    .eq('id', requestId)

  if (error) {
    console.error('[api/workspaces/:id/removals/:requestId] could not withdraw:', error)
    return NextResponse.json({ error: 'Could not withdraw that.' }, { status: 403 })
  }

  return NextResponse.json({ ok: true })
}
