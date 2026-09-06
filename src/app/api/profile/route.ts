import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { validateProfileDetails } from '@/lib/profile/details'
import { enforce } from '@/lib/rate-limit'

/**
 * PATCH /api/profile
 *
 * The five profile fields a student may change about themselves after
 * onboarding. Until now there were none: whatever you typed on your first
 * day was permanent, which is wrong for a graduation year and absurd for a
 * name.
 *
 * This goes through a route rather than a direct update from the browser
 * because the row holds more than these five columns. RLS lets a student
 * write their own row, so a client-side update would also let them write
 * their own application counter and their own .edu verification date. The
 * whitelist in validateProfileDetails is what stops that, and it only stops
 * it if every write goes through here.
 *
 * The account's display_name is kept in step in the same request. Two places
 * hold a name — the account row, which the navbar reads, and the student
 * row, which the profile reads — and letting them drift means the greeting
 * calls you one thing while your record calls you another.
 */
export async function PATCH(request: Request) {
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

  const check = validateProfileDetails(body)
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 })

  const { error } = await supabase
    .from('students')
    .update(check.values)
    .eq('id', user.id)

  if (error) {
    console.error('[api/profile] update failed:', error)
    return NextResponse.json({ error: 'Could not save your details.' }, { status: 500 })
  }

  // Best effort, and deliberately not awaited into a failure. If this write
  // loses, the profile is still correct and the navbar is briefly stale —
  // which is a much smaller problem than telling someone their save failed
  // when their details did in fact change.
  const { error: accountError } = await supabase
    .from('accounts')
    .update({ display_name: check.values.full_name })
    .eq('id', user.id)

  if (accountError) {
    console.error('[api/profile] display_name sync failed:', accountError)
  }

  return NextResponse.json({ ok: true })
}
