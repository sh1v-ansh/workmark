import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enforce } from '@/lib/rate-limit'
import { cleanEligibility } from '@/lib/profile/eligibility'

/**
 * PUT    /api/account/eligibility — save the student's answers.
 * DELETE /api/account/eligibility — forget all of them.
 *
 * Runs as the student's own session: the table's only policy is owner-only,
 * so nobody can write anybody else's row through here. See
 * lib/profile/eligibility.ts for what this data may and may not be used for.
 */
export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const limited = await enforce('profile', user.id)
  if (limited) return limited

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('student_eligibility')
    .upsert({ student_id: user.id, ...cleanEligibility(body), updated_at: new Date().toISOString() })
  if (error) {
    console.error('[api/account/eligibility] save failed:', error.message)
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const { error } = await supabase.from('student_eligibility').delete().eq('student_id', user.id)
  if (error) {
    console.error('[api/account/eligibility] delete failed:', error.message)
    return NextResponse.json({ error: 'Could not delete that.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
