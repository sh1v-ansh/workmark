import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enforce } from '@/lib/rate-limit'
import { parseBody, requireUuid, ValidationError } from '@/lib/http/validate'
import { parseListingFields } from '@/lib/listings/fields'
import { createListing } from '@/lib/listings/create'
import { MAX_WORKSPACE_MEMBERS } from '@/lib/workspace/membership'

/**
 * POST   /api/workspaces/[id]/publish — make this project public on Find work.
 * DELETE /api/workspaces/[id]/publish — take the posting down.
 *
 * A public project is an ordinary posting linked to this workspace
 * (workspaces.listing_id). When the owner accepts an applicant, the trigger
 * that already runs on every acceptance (attach_engagement_to_workspace)
 * finds the workspace through that link and adds them to this team, instead
 * of starting a new one.
 *
 * Owners only. The update policy on workspaces is owner-only too, so a
 * non-owner who got here would change nothing; the check below gives them a
 * sentence instead.
 */

async function ownedWorkspace(rawId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) } as const

  let id: string
  try {
    id = requireUuid(rawId, 'Project')
  } catch (err) {
    if (err instanceof ValidationError) return { error: NextResponse.json({ error: err.message }, { status: 400 }) } as const
    throw err
  }

  const limited = await enforce('listingEdit', user.id)
  if (limited) return { error: limited } as const

  const [{ data: workspace }, { data: me }] = await Promise.all([
    supabase.from('workspaces').select('id, title, status, listing_id').eq('id', id).maybeSingle(),
    supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', id)
      .eq('account_id', user.id)
      .not('accepted_at', 'is', null)
      .is('removed_at', null)
      .maybeSingle(),
  ])
  if (!workspace) return { error: NextResponse.json({ error: 'Project not found.' }, { status: 404 }) } as const
  if (me?.role !== 'owner') {
    return { error: NextResponse.json({ error: 'Only the project owner can do that.' }, { status: 403 }) } as const
  }
  return { supabase, user, workspace } as const
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const found = await ownedWorkspace((await params).id)
  if ('error' in found) return found.error
  const { supabase, user, workspace } = found

  if (workspace.status === 'closed' || workspace.status === 'abandoned') {
    return NextResponse.json({ error: 'A finished project cannot be posted.' }, { status: 400 })
  }

  // Already public and still open: nothing to do.
  if (workspace.listing_id) {
    const { data: current } = await supabase.from('listings').select('status').eq('id', workspace.listing_id).maybeSingle()
    if (current?.status === 'open') {
      return NextResponse.json({ error: 'This project is already public.' }, { status: 409 })
    }
  }

  const parsed = await parseBody(request)
  if (!parsed.ok) return parsed.response
  const body = parsed.body

  // Room left on the team: invitations count, because an unanswered invite
  // still holds a seat.
  const { count: seated } = await supabase
    .from('workspace_members')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspace.id)
    .is('removed_at', null)
  const room = MAX_WORKSPACE_MEMBERS - (seated ?? 1)
  const wanted = typeof body.maxCollaborators === 'number' ? body.maxCollaborators : NaN
  if (!Number.isInteger(wanted) || wanted < 1 || wanted > room) {
    return NextResponse.json(
      { error: room < 1 ? 'The team is already full.' : `Choose between 1 and ${room} collaborators.` },
      { status: 400 },
    )
  }

  // The same checks as any posting. The title is the project's own; the
  // team size is everyone already on it plus the seats being offered, so
  // the listing closes itself once they are filled.
  const fields = parseListingFields({
    ...body,
    title: workspace.title,
    team_size: (seated ?? 1) + wanted,
  })
  if (!fields.ok) return fields.response
  if (fields.values.kind !== 'collaborative' && fields.values.kind !== 'startup') {
    return NextResponse.json({ error: 'A project is posted as a collaborative project or a student startup.' }, { status: 400 })
  }

  const { data: me } = await supabase.from('students').select('full_name').eq('id', user.id).maybeSingle()
  const result = await createListing(supabase, { id: user.id, name: me?.full_name ?? null, isFaculty: false }, fields.values)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })

  const { error: linkErr } = await supabase.from('workspaces').update({ listing_id: result.id }).eq('id', workspace.id)
  if (linkErr) {
    console.error('[api/workspaces/:id/publish] link failed:', linkErr)
    // The posting exists but is not tied to this team, so an acceptance
    // would start a separate workspace. Close it rather than leave that trap.
    await supabase.from('listings').update({ status: 'closed' }).eq('id', result.id)
    return NextResponse.json({ error: 'Could not link the posting to this project. Nothing was published.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, listingId: result.id })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const found = await ownedWorkspace((await params).id)
  if ('error' in found) return found.error
  const { supabase, workspace } = found

  if (!workspace.listing_id) return NextResponse.json({ ok: true })

  // Closed, not deleted: applications already in keep their history, and
  // the link stays so reopening later reuses the same team.
  const { error } = await supabase.from('listings').update({ status: 'closed' }).eq('id', workspace.listing_id)
  if (error) {
    console.error('[api/workspaces/:id/publish] take down failed:', error)
    return NextResponse.json({ error: 'Could not take the posting down.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
