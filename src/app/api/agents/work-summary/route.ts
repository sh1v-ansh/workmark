import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { agentsAvailable } from '@/lib/agents/client'
import { draftWorkSummary } from '@/lib/agents/work-summary'
import { enforce } from '@/lib/rate-limit'

/**
 * POST /api/agents/work-summary  { engagementId, notes }
 *
 * Turns a student's rough notes into a draft description of the work they
 * did, for the close-out both sides have to agree on.
 *
 * Returns a draft and saves nothing. The description is written by the
 * existing engagement update route only when a person submits it, and it
 * still needs the other side to agree before the engagement closes — so
 * this cannot put model output into anybody's record on its own.
 *
 * Only the student on the engagement may call it. The poster gets to agree
 * or not agree to the description; they do not get to draft the student's
 * account of their own work.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const limited = await enforce('agent', user.id)
  if (limited) return limited

  if (!agentsAvailable()) {
    return NextResponse.json(
      { error: 'Writing help is not configured on this deployment.' },
      { status: 503 },
    )
  }

  let body: { engagementId?: string; notes?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const notes = typeof body.notes === 'string' ? body.notes.trim() : ''
  if (typeof body.engagementId !== 'string' || !body.engagementId) {
    return NextResponse.json({ error: 'Missing engagement.' }, { status: 400 })
  }
  // Refused rather than guessed at. A draft written from nothing would be
  // invention dressed as a record, which is the one thing this must not do.
  if (notes.length < 20) {
    return NextResponse.json(
      { error: 'Jot down a few notes on what you did first — even rough ones. We won\'t invent the details.' },
      { status: 400 },
    )
  }

  // Read under the student's own session, so RLS decides whether this
  // engagement is theirs to see at all.
  const { data: engagement } = await supabase
    .from('engagements')
    .select('id, student_id, listings(title, brief)')
    .eq('id', body.engagementId)
    .maybeSingle()

  if (!engagement) {
    return NextResponse.json({ error: 'Engagement not found.' }, { status: 404 })
  }
  if (engagement.student_id !== user.id) {
    return NextResponse.json(
      { error: 'Only the student who did the work can draft this description.' },
      { status: 403 },
    )
  }

  const listing = engagement.listings as unknown as { title: string | null; brief: string | null } | null

  try {
    const draft = await draftWorkSummary(supabase, user.id, {
      notes,
      listingTitle: listing?.title ?? null,
      listingBrief: listing?.brief ?? null,
    })
    if (!draft) {
      return NextResponse.json({ error: 'Could not draft a description. Try again.' }, { status: 502 })
    }
    return NextResponse.json({ description: draft.description })
  } catch (err) {
    console.error('[api/agents/work-summary] draft failed:', err)
    return NextResponse.json({ error: 'Could not draft a description. Try again.' }, { status: 502 })
  }
}
