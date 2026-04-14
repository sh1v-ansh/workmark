import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  // Parse body
  let body: { token?: string; status?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { token, status } = body

  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Missing token.' }, { status: 400 })
  }

  if (status !== 'verified' && status !== 'incomplete') {
    return NextResponse.json({ error: 'Invalid status value.' }, { status: 400 })
  }

  // Use service role — never expose this client to the browser
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Look up the record by token
  const { data: record, error: lookupError } = await supabase
    .from('experience_records')
    .select('id, verification_status')
    .eq('verification_token', token)
    .maybeSingle()

  if (lookupError || !record) {
    return NextResponse.json({ error: 'Record not found.' }, { status: 404 })
  }

  // Prevent re-verification
  if (
    record.verification_status === 'verified' ||
    record.verification_status === 'incomplete'
  ) {
    return NextResponse.json({ error: 'Already actioned.' }, { status: 409 })
  }

  // Apply update
  const updatePayload: Record<string, unknown> = {
    verification_status: status,
  }
  if (status === 'verified') {
    updatePayload.verified_at = new Date().toISOString()
  }

  const { error: updateError } = await supabase
    .from('experience_records')
    .update(updatePayload)
    .eq('id', record.id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update record.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
