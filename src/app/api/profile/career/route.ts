import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enforce } from '@/lib/rate-limit'
import { TRACK_IDS } from '@/lib/careers/tracks'

/**
 * PUT /api/profile/career: set or change the career track and the
 * student's own description of what they want to become. Null track means
 * "not sure yet". Only these columns are written, whatever else arrives.
 */
export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const limited = await enforce('profile', user.id)
  if (limited) return limited

  const body = (await request.json().catch(() => null)) as { track?: unknown; aspiration?: unknown } | null
  if (!body) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })

  const track = body.track === null || body.track === '' ? null : body.track
  if (track !== null && (typeof track !== 'string' || !TRACK_IDS.includes(track))) {
    return NextResponse.json({ error: 'Pick one of the listed careers.' }, { status: 400 })
  }
  const aspiration = typeof body.aspiration === 'string' ? body.aspiration.trim().slice(0, 500) || null : null

  const { error } = await supabase
    .from('students')
    .update({ career_track: track, aspiration, career_set_at: new Date().toISOString() })
    .eq('id', user.id)
  if (error) {
    console.error('[api/profile/career] update failed:', error)
    return NextResponse.json({ error: 'Could not save your career.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
