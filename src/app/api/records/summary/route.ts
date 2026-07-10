import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * PATCH /api/records/summary
 *
 * The student edits the auto-drafted engagement summary. Either party can
 * still change it until both have approved (locked_at IS NULL). Once locked,
 * the record is immutable per spec §6.4.
 */
export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null) as { id?: string; summary?: string } | null
  if (!body?.id || typeof body.summary !== 'string') {
    return NextResponse.json({ error: 'Missing id or summary.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const { data: record, error: readErr } = await supabase
    .from('verified_work_records')
    .select('id, student_id, poster_id, locked_at')
    .eq('id', body.id)
    .maybeSingle()

  if (readErr || !record) return NextResponse.json({ error: 'Record not found.' }, { status: 404 })
  if (record.student_id !== user.id && record.poster_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }
  if (record.locked_at) {
    return NextResponse.json({ error: 'Record is locked and cannot be edited.' }, { status: 409 })
  }

  const { error: updateErr } = await supabase
    .from('verified_work_records')
    .update({
      summary_final: body.summary,
      // Any edit invalidates the other party's prior approval — both must
      // re-approve to lock. This keeps the mutual-verification guarantee.
      student_approved_at: null,
      poster_approved_at: null,
    })
    .eq('id', record.id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
