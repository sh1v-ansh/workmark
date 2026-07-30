import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/collab/withdraw
 * body: { applicationId: string }
 *
 * Lets an applicant pull back their own still-pending collaboration request.
 * RLS ("Students: withdraw own pending application") already restricts this
 * to the applicant and to the applied -> withdrawn transition, so no service
 * role is needed here.
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
    .update({ status: 'withdrawn' })
    .eq('id', applicationId)
    .eq('student_id', user.id)
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!updated) return NextResponse.json({ error: 'Application not found, or it is no longer pending.' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
