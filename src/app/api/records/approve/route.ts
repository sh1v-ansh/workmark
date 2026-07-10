import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/records/approve
 *
 * The student clicks "Approve summary" (spec §3.2 Layer 2 step 3). Sets
 * student_approved_at. If the poster has already attested, this locks the
 * record and stamps the tier.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { id?: string } | null
  if (!body?.id) return NextResponse.json({ error: 'Missing record id.' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const { data: record, error: readErr } = await supabase
    .from('verified_work_records')
    .select('id, student_id, poster_type, locked_at, poster_approved_at')
    .eq('id', body.id)
    .maybeSingle()

  if (readErr || !record) return NextResponse.json({ error: 'Record not found.' }, { status: 404 })
  if (record.student_id !== user.id) return NextResponse.json({ error: 'Only the student can approve on the student side.' }, { status: 403 })
  if (record.locked_at) return NextResponse.json({ error: 'Record is locked.' }, { status: 409 })

  const now = new Date().toISOString()
  const willLock = record.poster_approved_at != null
  const tier = record.poster_type === 'company' ? 1 : 2

  const update: Record<string, unknown> = { student_approved_at: now }
  if (willLock) {
    update.locked_at = now
    update.tier = tier
  }

  const { error: updateErr } = await supabase
    .from('verified_work_records')
    .update(update)
    .eq('id', record.id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
  return NextResponse.json({ success: true, locked: willLock })
}
