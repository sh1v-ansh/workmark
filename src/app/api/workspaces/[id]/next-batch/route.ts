import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { enforce } from '@/lib/rate-limit'
import { requireUuid, ValidationError } from '@/lib/http/validate'
import { localNow, releaseDailyBatch } from '@/lib/workspace/daily'

/**
 * POST /api/workspaces/[id]/next-batch — "start tomorrow's tasks now", for
 * somebody on a daily pace who finished early. Releases one batch straight
 * away; the morning batch still comes as usual.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  // Read as the caller: somebody not on the project gets nothing back.
  const { data: workspace } = await supabase.from('workspaces').select('id, pace, timezone, status').eq('id', id).maybeSingle()
  if (!workspace) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
  if (workspace.status !== 'active') return NextResponse.json({ error: 'This project is not active.' }, { status: 400 })

  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { date } = localNow(workspace.timezone as string | null)
  const released = await releaseDailyBatch(admin, id, date)
  if (released.length === 0) {
    return NextResponse.json({ error: 'Nothing to hand out right now. Finish what you have first, or the plan is done.' }, { status: 409 })
  }
  return NextResponse.json({ ok: true, count: released.length })
}
