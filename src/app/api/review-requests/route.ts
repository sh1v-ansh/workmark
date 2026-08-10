import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// One open request at a time. A queue reviewed by one person degrades
// fast if anyone can fill it; this is the cheapest possible backpressure
// and it costs a diligent student nothing.
const MAX_PENDING = 1

/**
 * POST /api/review-requests
 *
 * §3's fallback verification path: work that can't be machine-checked —
 * a design portfolio, a research writeup, a demo that only exists as a
 * video — goes into a queue for a person to look at.
 *
 * Runs under the student's own session; review_requests has a self-insert
 * policy and filing genuinely is the student's act. Approving is
 * service-role only, and this route deliberately cannot approve anything.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  let body: { url?: string; note?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const url = body.url?.trim()
  const note = body.note?.trim()

  if (!url) return NextResponse.json({ error: 'Add a link to the work.' }, { status: 400 })
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('bad protocol')
  } catch {
    return NextResponse.json({ error: 'That doesn\'t look like a valid link.' }, { status: 400 })
  }
  if (!note || note.length < 30) {
    return NextResponse.json(
      { error: 'Describe what it is and what you built — a reviewer has no commit history to read here.' },
      { status: 400 },
    )
  }

  const { count } = await supabase
    .from('review_requests')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', user.id)
    .eq('status', 'pending')
  if ((count ?? 0) >= MAX_PENDING) {
    return NextResponse.json(
      { error: 'You already have a review pending. Wait for that one before submitting another.' },
      { status: 400 },
    )
  }

  const { data, error } = await supabase
    .from('review_requests')
    .insert({ student_id: user.id, url, note })
    .select('id')
    .single()
  if (error) {
    console.error('[api/review-requests] insert failed:', error)
    return NextResponse.json({ error: 'Could not submit for review.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data.id })
}
