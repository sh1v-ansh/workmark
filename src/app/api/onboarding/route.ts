import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * POST /api/onboarding
 *
 * Creates the account row and the profile together.
 *
 * This has to be server-side because `accounts` has no insert policy for
 * regular users — an account row says what someone is allowed to be, so
 * letting the client write it would let anyone grant themselves admin. The
 * role is taken from the form but narrowed here: 'admin' is never accepted
 * from a request, at any point, ever.
 *
 * Faculty is self-declared and starts unverified. That's deliberate: an
 * unverified faculty account works fully, it just doesn't carry faculty
 * weight when attestation lands. Verification gates the weight, not the
 * account — so claiming it falsely gains nothing, and nobody waits on us.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  let body: { role?: string; profile?: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 400 })
  }

  // Only these two are self-selectable. Admin is granted out of band and a
  // signup path must never be able to produce one.
  const role = body.role === 'faculty' ? 'faculty' : 'student'
  const profile = body.profile ?? {}

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const domain = user.email?.split('@')[1] ?? null

  // The account first. If the profile insert fails afterwards the account is
  // harmless on its own — it carries no data and onboarding is idempotent —
  // whereas a profile with no account would be a person with no role, which
  // is the state every permission check reads as "nothing allowed".
  const { error: accountErr } = await admin
    .from('accounts')
    .upsert({ id: user.id, roles: [role], updated_at: new Date().toISOString() }, { onConflict: 'id' })
  if (accountErr) {
    console.error('[api/onboarding] account write failed:', accountErr)
    return NextResponse.json({ error: 'Could not create your account.' }, { status: 500 })
  }

  const { error: profileErr } = await admin.from('students').insert({
    id: user.id,
    ...profile,
    // The permanent record of how this account was verified. The login email
    // can change later — a .edu expires at graduation — but this pair
    // doesn't.
    edu_domain: domain,
    edu_verified_at: new Date().toISOString(),
  })

  // 23505 is the primary key: a profile already exists, which is a success
  // state for the person even though the insert failed.
  if (profileErr && profileErr.code !== '23505') {
    console.error('[api/onboarding] profile write failed:', profileErr)
    return NextResponse.json({ error: 'Could not save your profile.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, role })
}
