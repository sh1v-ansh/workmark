import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { readFields, requireInt, requireBoolean } from '@/lib/http/validate'

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

  // wouldRehire and hiredBeyondEngagement go straight into boolean columns.
  // Passed through unchecked, a string there was a Postgres type error and a
  // 500 on a form somebody had just filled in.
  const fields = readFields(() => ({
    satisfaction: body.posterSatisfaction === undefined || body.posterSatisfaction === null
      ? null
      : requireInt(body.posterSatisfaction, 'Satisfaction', { min: 1, max: 5 }),
    wouldRehire: body.wouldRehire === undefined || body.wouldRehire === null
      ? null
      : requireBoolean(body.wouldRehire, 'Would rehire'),
    hiredBeyond: body.hiredBeyondEngagement === undefined || body.hiredBeyondEngagement === null
      ? false
      : requireBoolean(body.hiredBeyondEngagement, 'Hired beyond the engagement'),
  }))
  if (!fields.ok) return fields.response
  const { satisfaction, wouldRehire, hiredBeyond } = fields.values

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
    poster_satisfaction: satisfaction,
    would_rehire: wouldRehire,
    hired_beyond_engagement: hiredBeyond,
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
