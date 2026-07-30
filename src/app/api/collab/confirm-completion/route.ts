import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/collab/confirm-completion
 * body: { applicationId: string, summary?: string }
 *
 * Either side of an accepted peer collaboration confirms the work happened.
 * Runs entirely under the caller's own session — RLS ("Peer records:
 * participants read/confirm completion") already restricts this to the two
 * participants, so no service role is needed here (unlike accept, which
 * needs auth.users for real emails).
 *
 * Once both sides have confirmed, the record locks — same "both sides tap
 * yes" pattern as employer attestation, just without the 6-question co-write.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  let body: { applicationId?: string; summary?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const { applicationId, summary } = body
  if (!applicationId) return NextResponse.json({ error: 'Missing applicationId.' }, { status: 400 })

  const { data: record, error: fetchErr } = await supabase
    .from('peer_records')
    .select('id, poster_id, student_id, poster_confirmed_at, student_confirmed_at, locked_at')
    .eq('application_id', applicationId)
    .maybeSingle()

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!record) return NextResponse.json({ error: 'No peer record found for this application.' }, { status: 404 })

  if (record.locked_at) {
    return NextResponse.json({ ok: true, locked: true })
  }

  const isPoster = user.id === record.poster_id
  const isStudent = user.id === record.student_id
  if (!isPoster && !isStudent) {
    return NextResponse.json({ error: 'You are not part of this collaboration.' }, { status: 403 })
  }

  const now = new Date().toISOString()
  const posterConfirmedAt = isPoster ? now : record.poster_confirmed_at
  const studentConfirmedAt = isStudent ? now : record.student_confirmed_at
  const bothConfirmed = !!posterConfirmedAt && !!studentConfirmedAt

  const update: Record<string, unknown> = {
    poster_confirmed_at: posterConfirmedAt,
    student_confirmed_at: studentConfirmedAt,
  }
  if (summary?.trim()) update.summary = summary.trim()
  if (bothConfirmed) update.locked_at = now

  const { error: updateErr } = await supabase
    .from('peer_records')
    .update(update)
    .eq('id', record.id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, locked: bothConfirmed })
}
