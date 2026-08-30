import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * The domains that count as proof of being at a university.
 *
 * The same rule the signup form applies, enforced here as well. The form
 * check is a courtesy that tells someone early; this one is what actually
 * decides, because a form check protects nobody — the route is reachable
 * directly, and "students only" is the claim the whole product rests on.
 *
 * Kept as a list so widening it later (.ac.uk, .edu.au) is a one-line
 * change in one place rather than a hunt through the codebase.
 */
const ACADEMIC_SUFFIXES = ['.edu']

function isAcademicEmail(email: string | undefined): boolean {
  if (!email) return false
  const addr = email.toLowerCase().trim()
  return ACADEMIC_SUFFIXES.some((suffix) => addr.endsWith(suffix))
}

/**
 * POST /api/onboarding  { role, profile }
 *
 * Creates the account row, and — for students — the profile that hangs off
 * it. Runs under the service role because `accounts` deliberately has no
 * insert policy for users: an account row says what someone is allowed to
 * be, so a client that could write it could grant itself admin.
 *
 * Three rules this enforces that the form alone cannot:
 *
 *  1. The email has to be academic. See above.
 *  2. It runs once per account. Onboarding used to upsert, which meant
 *     hitting it a second time overwrote `roles` — an admin who revisited
 *     the page was silently demoted to a plain student, and anyone could
 *     re-declare themselves faculty at any point by calling it again.
 *     Refusing a second run makes the declared role a signup-time decision,
 *     which is the only point at which self-declaration is defensible.
 *  3. Faculty get no student record. A professor is not a student row with
 *     a different label on it.
 *  4. A faculty claim is recorded as unconfirmed. The account opens
 *     immediately — nobody waits on us — but `faculty_requested_at` is set
 *     and `faculty_verified_at` stays null until a person confirms it, and
 *     the UI shows the difference. See v05_0014.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  if (!isAcademicEmail(user.email)) {
    return NextResponse.json(
      { error: 'Workmark accounts require a university (.edu) email address.' },
      { status: 403 },
    )
  }

  let body: { role?: string; profile?: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 400 })
  }

  // Narrowed rather than trusted. 'admin' can never arrive this way — the
  // only route to it is somebody running scripts/grant-role.mjs with the
  // service key.
  const role = body.role === 'faculty' ? 'faculty' : 'student'
  const profile = body.profile ?? {}

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Already set up? Say so and stop, without touching the roles that are
  // already there.
  const { data: existing } = await admin
    .from('accounts')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'This account has already been set up.', alreadyOnboarded: true },
      { status: 409 },
    )
  }

  const displayName = typeof profile.full_name === 'string' ? profile.full_name : null
  const institution = typeof profile.university === 'string' ? profile.university : null

  // Insert, not upsert. A duplicate here means two requests raced, and the
  // loser must not overwrite the winner's roles.
  //
  // A faculty account opens straight away. `faculty_requested_at` records
  // that the claim is waiting on a person, and `faculty_verified_at` stays
  // null until one confirms it — which is what the pending badge reads.
  const { error: accountErr } = await admin.from('accounts').insert({
    id: user.id,
    roles: [role],
    faculty_requested_at: role === 'faculty' ? new Date().toISOString() : null,
    display_name: displayName,
    institution,
  })

  if (accountErr) {
    if (accountErr.code === '23505') {
      return NextResponse.json(
        { error: 'This account has already been set up.', alreadyOnboarded: true },
        { status: 409 },
      )
    }
    console.error('[api/onboarding] account write failed:', accountErr)
    return NextResponse.json({ error: 'Could not create your account.' }, { status: 500 })
  }

  // Students get the profile the scanner, the matcher and the public record
  // all read. Faculty get nothing here on purpose — their name and
  // institution are on the account row above, and a professor in `students`
  // is a professor in the student directory and the matching pool.
  if (role === 'student') {
    const { error: profileErr } = await admin.from('students').insert({
      id: user.id,
      ...profile,
      edu_domain: user.email?.split('@')[1] ?? null,
      edu_verified_at: new Date().toISOString(),
    })

    // 23505 means the profile was already there — an earlier partial signup,
    // or a retry. Not a failure: the account row is what this route is for.
    if (profileErr && profileErr.code !== '23505') {
      console.error('[api/onboarding] profile write failed:', profileErr)
      return NextResponse.json({ error: 'Could not save your profile.' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, role, verificationPending: role === 'faculty' })
}
