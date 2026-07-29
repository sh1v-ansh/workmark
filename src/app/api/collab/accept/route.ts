import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * POST /api/collab/accept
 * body: { applicationId: string }
 *
 * Accepts a collaboration request on a student-posted project and exchanges
 * contact info between the two students. Peer collaborations don't flow into
 * verified_work_records (that pipeline stays scoped to employer/faculty
 * attestation) — accepting just unlocks each side's real email.
 *
 * The status update runs under the caller's own session (RLS already only
 * lets a project's poster update its applications). Reading real emails
 * requires service_role since auth.users isn't queryable under RLS.
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

  // RLS ("Posters: update application status for their projects") enforces
  // that this only succeeds if `user` actually posted the project this
  // application belongs to — no manual authorization check needed here.
  const { data: updated, error: updateErr } = await supabase
    .from('applications')
    .update({ status: 'accepted' })
    .eq('id', applicationId)
    .select('id, student_id, project_id')
    .maybeSingle()

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
  if (!updated) return NextResponse.json({ error: 'Application not found, or you are not the poster.' }, { status: 404 })

  // If contact info was already shared (e.g. a retry), just return it.
  const { data: existingShare } = await supabase
    .from('contact_shares')
    .select('student_email, poster_email')
    .eq('application_id', applicationId)
    .maybeSingle()

  if (existingShare) {
    return NextResponse.json({ ok: true, ...existingShare })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const [{ data: applicant }, { data: poster }] = await Promise.all([
    admin.auth.admin.getUserById(updated.student_id),
    admin.auth.admin.getUserById(user.id),
  ])

  const studentEmail = applicant?.user?.email ?? null
  const posterEmail = poster?.user?.email ?? null

  const { error: shareErr } = await admin.from('contact_shares').insert({
    application_id: updated.id,
    student_id: updated.student_id,
    poster_id: user.id,
    student_email: studentEmail,
    poster_email: posterEmail,
  })

  if (shareErr) return NextResponse.json({ error: shareErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, student_email: studentEmail, poster_email: posterEmail })
}
