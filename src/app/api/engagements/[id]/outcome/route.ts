import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/engagements/[id]/outcome
 *
 * The poster's satisfaction rating, recorded after close-out.
 *
 * Runs under the caller's own session: outcomes has a poster-scoped
 * insert policy, so RLS is the authorization check. Deliberately NOT
 * service-role — this genuinely is the poster's own statement, and
 * routing it through an elevated client would obscure that.
 *
 * Nothing here feeds skill depth. Satisfaction is a signal about the
 * engagement, not a measurement of the student's skills, and letting a
 * 1-5 star rating move an evidence score would reintroduce exactly the
 * unaccountable-reputation problem the evidence ladder exists to avoid.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  let body: { posterSatisfaction?: number; wouldRehire?: boolean; hiredBeyondEngagement?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const satisfaction = body.posterSatisfaction
  if (satisfaction !== undefined && (!Number.isInteger(satisfaction) || satisfaction < 1 || satisfaction > 5)) {
    return NextResponse.json({ error: 'Satisfaction must be a whole number from 1 to 5.' }, { status: 400 })
  }

  const { data: engagement } = await supabase
    .from('engagements')
    .select('id, poster_id, stage')
    .eq('id', id)
    .maybeSingle()
  if (!engagement) return NextResponse.json({ error: 'Engagement not found.' }, { status: 404 })
  if (engagement.poster_id !== user.id) {
    return NextResponse.json({ error: 'Only the poster can record an outcome.' }, { status: 403 })
  }
  if (engagement.stage !== 'closed') {
    return NextResponse.json({ error: 'Close the engagement out before recording an outcome.' }, { status: 400 })
  }

  const row: Record<string, unknown> = {
    engagement_id: id,
    poster_satisfaction: satisfaction ?? null,
    would_rehire: body.wouldRehire ?? null,
    hired_beyond_engagement: body.hiredBeyondEngagement ?? false,
  }
  if (body.hiredBeyondEngagement) {
    row.hired_beyond_engagement_at = new Date().toISOString()
    row.hired_beyond_engagement_source = 'poster_report'
  }

  const { error } = await supabase.from('outcomes').upsert(row, { onConflict: 'engagement_id' })
  if (error) {
    console.error('[api/engagements/outcome] insert failed:', error)
    return NextResponse.json({ error: 'Could not record the outcome.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
