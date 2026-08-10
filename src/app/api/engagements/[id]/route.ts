import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { canTransition, isTerminal, type Stage, type Actor } from '@/lib/engagements/lifecycle'
import { workSubmitted } from '@/lib/notify/email'
import { recordPlatformSignals } from '@/lib/engagements/signals'

/**
 * PATCH /api/engagements/[id]
 *
 * Stage transitions, the agreed work description, and visibility.
 * Runs as the caller's own session — engagements has a participants-only
 * update policy, so RLS proves membership and this route only has to
 * enforce the rules RLS can't express (who may make which transition,
 * and that agreeing to a description is not the same as writing it).
 *
 * Close-out is deliberately NOT here: it mints evidence and needs
 * service-role, so it lives in ./close.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  let body: { stage?: Stage; description?: string; agreeToDescription?: boolean; visibility?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { data: engagement } = await supabase
    .from('engagements')
    .select('id, application_id, listing_id, student_id, poster_id, stage, opened_at, submitted_at, abandoned_at, description, description_agreed_by_student_at, description_agreed_by_poster_at')
    .eq('id', id)
    .maybeSingle()
  if (!engagement) return NextResponse.json({ error: 'Engagement not found.' }, { status: 404 })

  const actor: Actor | null =
    engagement.student_id === user.id ? 'student' : engagement.poster_id === user.id ? 'poster' : null
  if (!actor) return NextResponse.json({ error: 'You are not part of this engagement.' }, { status: 403 })

  const currentStage = engagement.stage as Stage
  const patch: Record<string, unknown> = {}

  // ── Description ──
  // Editing the text clears BOTH agreements: an agreement is to specific
  // wording, so silently keeping it after an edit would let one party
  // change what the other signed off on.
  if (body.description !== undefined) {
    if (isTerminal(currentStage)) {
      return NextResponse.json({ error: 'This engagement is closed — the description can no longer change.' }, { status: 400 })
    }
    const next = body.description.trim()
    if (next !== (engagement.description ?? '')) {
      patch.description = next || null
      patch.description_agreed_by_student_at = null
      patch.description_agreed_by_poster_at = null
    }
  }

  if (body.agreeToDescription) {
    if (isTerminal(currentStage)) {
      return NextResponse.json({ error: 'This engagement is already closed.' }, { status: 400 })
    }
    // Agreeing to a description that's being changed in the same request
    // would agree to text the other party hasn't seen.
    const effective = patch.description !== undefined ? patch.description : engagement.description
    if (!effective) {
      return NextResponse.json({ error: 'There is no description to agree to yet.' }, { status: 400 })
    }
    patch[actor === 'student' ? 'description_agreed_by_student_at' : 'description_agreed_by_poster_at'] =
      new Date().toISOString()
  }

  // ── Visibility ──
  // The student's call alone: it governs how THEIR record displays.
  if (body.visibility !== undefined) {
    if (actor !== 'student') {
      return NextResponse.json({ error: 'Only the student can set visibility on their own record.' }, { status: 403 })
    }
    if (!['full', 'redacted', 'hidden'].includes(body.visibility)) {
      return NextResponse.json({ error: 'Unsupported visibility.' }, { status: 400 })
    }
    patch.visibility = body.visibility
  }

  // ── Stage ──
  if (body.stage !== undefined && body.stage !== currentStage) {
    if (body.stage === 'closed') {
      return NextResponse.json({ error: 'Use the close-out endpoint to close an engagement.' }, { status: 400 })
    }
    if (!canTransition(currentStage, body.stage, actor)) {
      return NextResponse.json(
        { error: `You can't move this from "${currentStage}" to "${body.stage}".` },
        { status: 400 },
      )
    }
    patch.stage = body.stage
    if (body.stage === 'submitted') patch.submitted_at = new Date().toISOString()
    if (body.stage === 'abandoned') patch.abandoned_at = new Date().toISOString()
    // Moving back to in_progress reopens the work, so the prior
    // submission timestamp no longer describes the current state.
    if (body.stage === 'in_progress') patch.submitted_at = null
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true, unchanged: true })
  }

  const { error } = await supabase.from('engagements').update(patch).eq('id', id)
  if (error) {
    console.error('[api/engagements] update failed:', error)
    return NextResponse.json({ error: 'Could not update the engagement.' }, { status: 500 })
  }

  if (patch.stage === 'submitted' || patch.stage === 'abandoned') {
    try {
      const admin = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )
      await recordPlatformSignals(admin, {
        id: engagement.id,
        application_id: engagement.application_id,
        listing_id: engagement.listing_id,
        opened_at: engagement.opened_at,
        submitted_at: (patch.submitted_at as string | null) ?? engagement.submitted_at,
        closed_at: null,
        abandoned_at: (patch.abandoned_at as string | null) ?? engagement.abandoned_at,
        description_agreed_by_student_at: engagement.description_agreed_by_student_at,
        description_agreed_by_poster_at: engagement.description_agreed_by_poster_at,
      })
    } catch (err) {
      console.error('[api/engagements] platform signals failed:', err)
    }
  }

  if (patch.stage === 'submitted') {
    try {
      const admin = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )
      const [{ data: poster }, { data: student }, { data: full }] = await Promise.all([
        admin.auth.admin.getUserById(engagement.poster_id),
        admin.from('students').select('full_name').eq('id', engagement.student_id).maybeSingle(),
        admin.from('engagements').select('listings(title)').eq('id', id).maybeSingle(),
      ])
      const listing = full?.listings as unknown as { title: string | null } | null
      if (poster?.user?.email) {
        await workSubmitted({
          posterEmail: poster.user.email,
          studentName: student?.full_name ?? 'The student',
          listingTitle: listing?.title ?? 'your project',
          engagementId: id,
        })
      }
    } catch (err) {
      console.error('[api/engagements] notification failed:', err)
    }
  }

  return NextResponse.json({ ok: true })
}
