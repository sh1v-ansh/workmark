import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { notifyInvited } from '@/lib/workspace/notify'
import { enforce } from '@/lib/rate-limit'
import { MAX_WORKSPACE_MEMBERS } from '@/lib/workspace/membership'
import {
  parseBody, readFields, requireString, requireUuid, ValidationError, isEduAddress,
} from '@/lib/http/validate'

/**
 * POST /api/workspaces/[id]/members — invite someone.
 *
 * By handle or by email. The handle path reads `students`, which is public
 * for anyone who has claimed one. The email path needs auth.users, which RLS
 * cannot see, so it goes through the service role — for a lookup only, and
 * the address is never returned to the caller.
 *
 * An invitation grants nothing. It is a row with accepted_at still null, and
 * is_workspace_member ignores those, so nobody joins a project by being
 * named in one. They have to answer it, and answering requires GitHub —
 * see the trigger in v05_0026.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const fields = readFields(() => ({
    identifier: requireString(parsed.body.identifier, 'A handle or email address', { max: 254 }),
  }))
  if (!fields.ok) return fields.response
  const identifier = fields.values.identifier.replace(/^@/, '')

  // Counted here as well as in the trigger, so the answer is a sentence
  // rather than a database exception. The trigger is what actually holds.
  const { count } = await supabase
    .from('workspace_members')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', id)
    .is('removed_at', null)

  if ((count ?? 0) >= MAX_WORKSPACE_MEMBERS) {
    return NextResponse.json(
      { error: `A project holds at most ${MAX_WORKSPACE_MEMBERS} people, including invitations that haven't been answered.` },
      { status: 400 },
    )
  }

  let targetId: string | null = null

  if (identifier.includes('@')) {
    const email = identifier.toLowerCase()
    if (!isEduAddress(email)) {
      return NextResponse.json(
        { error: 'Workmark accounts use a university (.edu) address.' },
        { status: 400 },
      )
    }
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    // listUsers rather than a filter, because the admin API has no
    // "get by email" and this is a small enough population to page through.
    const { data: found } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    targetId = found?.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null
  } else {
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('handle', identifier)
      .maybeSingle()
    targetId = (student?.id as string) ?? null
  }

  if (!targetId) {
    return NextResponse.json(
      { error: 'No Workmark account found for that. They need to sign up first.' },
      { status: 404 },
    )
  }
  if (targetId === user.id) {
    return NextResponse.json({ error: 'You are already on this project.' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('workspace_members')
    .select('id, accepted_at, removed_at')
    .eq('workspace_id', id)
    .eq('account_id', targetId)
    .maybeSingle()

  if (existing && !existing.removed_at) {
    return NextResponse.json(
      { error: existing.accepted_at ? 'They are already on this project.' : 'They have already been invited.' },
      { status: 409 },
    )
  }

  // Re-inviting somebody who left clears the removal rather than making a
  // second row — the unique constraint is on (workspace, account), and their
  // history is in removed_reason either way.
  const { error } = existing
    ? await supabase
        .from('workspace_members')
        .update({ removed_at: null, accepted_at: null, invited_by: user.id, invited_at: new Date().toISOString() })
        .eq('id', existing.id)
    : await supabase
        .from('workspace_members')
        .insert({ workspace_id: id, account_id: targetId, invited_by: user.id })

  if (error) {
    if (error.code === '42501') {
      return NextResponse.json({ error: 'Only an owner can invite people.' }, { status: 403 })
    }
    if (error.code === '23514') {
      return NextResponse.json({ error: `A project holds at most ${MAX_WORKSPACE_MEMBERS} people.` }, { status: 400 })
    }
    console.error('[api/workspaces/:id/members] invite failed:', error)
    return NextResponse.json({ error: 'Could not send that invitation.' }, { status: 500 })
  }

  // The half that makes an invitation an invitation. Without it the row only
  // surfaces if the person happens to visit /workspaces, which is precisely
  // the audience an invitation exists to reach.
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: workspace } = await admin
    .from('workspaces')
    .select('title')
    .eq('id', id)
    .maybeSingle()

  await notifyInvited(admin, {
    workspaceId: id,
    inviteeId: targetId,
    inviterId: user.id,
    projectTitle: (workspace?.title as string) ?? 'a project',
  })

  return NextResponse.json({ ok: true })
}
