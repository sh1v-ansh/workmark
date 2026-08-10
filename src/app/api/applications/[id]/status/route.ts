import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * PATCH /api/applications/[id]/status
 *
 * Poster-driven transitions: shortlisted / rejected / accepted.
 *
 * Accepting does three things atomically-in-intent (see the failure note
 * below): flips the application, exchanges real contact details, and opens
 * an engagement. The contact exchange has to be service-role — the real
 * email addresses live in auth.users, which RLS can't reach, and
 * contact_shares deliberately has no user insert policy so neither side
 * can fabricate an exchange that didn't happen.
 */
const ALLOWED = new Set(['shortlisted', 'rejected', 'accepted'])

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: applicationId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  let body: { status?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const status = body.status
  if (!status || !ALLOWED.has(status)) {
    return NextResponse.json({ error: 'Unsupported status.' }, { status: 400 })
  }

  // Read through the caller's own session first: the poster-scoped RLS
  // policy is what proves this listing is theirs, so an application that
  // isn't visible here isn't theirs to touch.
  const { data: application } = await supabase
    .from('applications')
    .select('id, listing_id, student_id, status, listings(poster_id, title, status)')
    .eq('id', applicationId)
    .maybeSingle()
  if (!application) return NextResponse.json({ error: 'Application not found.' }, { status: 404 })

  const listing = application.listings as unknown as { poster_id: string; title: string | null; status: string } | null
  if (!listing || listing.poster_id !== user.id) {
    return NextResponse.json({ error: 'Only the poster can change an application status.' }, { status: 403 })
  }
  if (application.status === 'withdrawn') {
    return NextResponse.json({ error: 'This application was withdrawn.' }, { status: 400 })
  }
  if (application.status === 'accepted' && status !== 'accepted') {
    return NextResponse.json({ error: 'An accepted application cannot be changed back.' }, { status: 400 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { error: statusErr } = await admin.from('applications').update({ status }).eq('id', applicationId)
  if (statusErr) {
    console.error('[api/applications/status] update failed:', statusErr)
    return NextResponse.json({ error: 'Could not update the application.' }, { status: 500 })
  }

  if (status !== 'accepted') {
    return NextResponse.json({ ok: true, status })
  }

  // ── Acceptance side effects ──
  // Each is individually idempotent (unique constraints on
  // contact_shares.application_id and engagements.application_id), so a
  // retry after a partial failure converges rather than duplicating.
  const [{ data: studentAuth }, { data: posterAuth }] = await Promise.all([
    admin.auth.admin.getUserById(application.student_id),
    admin.auth.admin.getUserById(user.id),
  ])

  const { error: shareErr } = await admin.from('contact_shares').upsert(
    {
      application_id: applicationId,
      student_id: application.student_id,
      poster_id: user.id,
      student_email: studentAuth?.user?.email ?? null,
      poster_email: posterAuth?.user?.email ?? null,
    },
    { onConflict: 'application_id' },
  )
  if (shareErr) console.error('[api/applications/status] contact share failed:', shareErr)

  const { error: engagementErr } = await admin.from('engagements').upsert(
    {
      application_id: applicationId,
      listing_id: application.listing_id,
      poster_id: user.id,
      student_id: application.student_id,
      stage: 'accepted',
    },
    { onConflict: 'application_id' },
  )
  if (engagementErr) console.error('[api/applications/status] engagement failed:', engagementErr)

  if (shareErr || engagementErr) {
    return NextResponse.json(
      { ok: true, status, warning: 'Accepted, but contact details or the engagement record may not have been created. Try accepting again.' },
    )
  }

  return NextResponse.json({ ok: true, status })
}
