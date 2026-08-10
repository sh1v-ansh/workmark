import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { validateHandle } from '@/lib/profile/handle'

/**
 * PUT /api/profile/handle
 *
 * Claims (or changes) the student's public profile handle.
 *
 * Claiming a handle IS the opt-in to a public profile — before one
 * exists, /p/... has nothing to resolve and the record isn't reachable
 * by anyone but the student and posters they applied to. That makes
 * this a publication decision, so it's an explicit action rather than
 * something onboarding does silently.
 */
export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  let body: { handle?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (typeof body.handle !== 'string') {
    return NextResponse.json({ error: 'Missing handle.' }, { status: 400 })
  }

  const check = validateHandle(body.handle)
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 })

  const { error } = await supabase
    .from('students')
    .update({ handle: check.handle })
    .eq('id', user.id)

  if (error) {
    // 23505 = the unique constraint on students.handle. Reported as a
    // plain "taken" rather than a database error, and deliberately
    // without saying who has it.
    if (error.code === '23505') {
      return NextResponse.json({ error: 'That handle is already taken.' }, { status: 409 })
    }
    console.error('[api/profile/handle] update failed:', error)
    return NextResponse.json({ error: 'Could not save your handle.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, handle: check.handle })
}
