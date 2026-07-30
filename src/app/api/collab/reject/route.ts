import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/collab/reject
 * body: { applicationId: string }
 *
 * Rejects a collaboration request on a student-posted project. RLS ("Posters:
 * update application status for their projects") enforces that only the
 * project's poster can do this — no service role needed.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  let body: { applicationId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const { applicationId } = body
  if (!applicationId) return NextResponse.json({ error: 'Missing applicationId.' }, { status: 400 })

  const { data: updated, error } = await supabase
    .from('applications')
    .update({ status: 'rejected' })
    .eq('id', applicationId)
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!updated) return NextResponse.json({ error: 'Application not found, or you are not the poster.' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
