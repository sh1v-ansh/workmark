import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { enforce } from '@/lib/rate-limit'
import { requireUuid, ValidationError } from '@/lib/http/validate'
import { validTimezone } from '@/lib/workspace/daily'

/**
 * PUT /api/workspaces/[id]/pace — switch between daily tasks and the whole
 * plan. Owners only. Switching to the whole plan just shows the backlog;
 * switching to daily hides it again from tomorrow's batch on.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const body = (await request.json().catch(() => null)) as { pace?: unknown; timezone?: unknown } | null
  const pace = body?.pace
  if (pace !== 'daily' && pace !== 'all_at_once') {
    return NextResponse.json({ error: 'Pick daily tasks or the whole plan.' }, { status: 400 })
  }

  const { data: me } = await supabase.from('workspace_members').select('role')
    .eq('workspace_id', id).eq('account_id', user.id).is('removed_at', null).maybeSingle()
  if (me?.role !== 'owner') return NextResponse.json({ error: 'Only the project owner can change this.' }, { status: 403 })

  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const update: Record<string, unknown> = { pace }
  const tz = validTimezone(body?.timezone)
  if (tz) update.timezone = tz
  const { error } = await admin.from('workspaces').update(update).eq('id', id)
  if (error) {
    console.error('[api/workspaces/pace] update failed:', error)
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
