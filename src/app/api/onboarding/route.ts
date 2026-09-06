import { createClient } from '@/lib/supabase/server'
import { enforce } from '@/lib/rate-limit'
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

/**
 * Which version of the terms this signup accepted.
 *
 * Bump it whenever the documents materially change. Existing rows keep the
 * version they agreed to rather than being rewritten — someone who accepted
 * v1 has not accepted v2, and a re-acceptance prompt needs to be able to
 * tell the difference.
 */
const TERMS_VERSION = 'terms_v1'

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
 *  5. Nobody is created without confirming they are 18+ and agreeing to
 *     the Terms, Privacy Policy and Cookie Policy.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const limited = await enforce('onboarding', user.id)
  if (limited) return limited

  if (!isAcademicEmail(user.email)) {
    return NextResponse.json(
      { error: 'Workmark accounts require a university (.edu) email address.' },
      { status: 403 },
    )
  }

  let body: { role?: string; profile?: Record<string, unknown>; heardAbout?: unknown; heardAboutDetail?: unknown }
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

  // Optional, and validated against the same list the column allows so an
  // unexpected value is dropped rather than failing the whole signup. A
  // dropped attribution answer costs us one data point; a rejected signup
  // costs us the student.
  const HEARD_ABOUT = [
    'friend', 'professor', 'club_or_society', 'social_media',
    'search', 'event', 'other', 'prefer_not_to_say',
  ]
  const heardAbout = typeof body.heardAbout === 'string' && HEARD_ABOUT.includes(body.heardAbout)
    ? body.heardAbout
    : null
  const heardAboutDetail = heardAbout === 'other' && typeof body.heardAboutDetail === 'string'
    ? body.heardAboutDetail.trim().slice(0, 200) || null
    : null
  const institution = typeof profile.university === 'string' ? profile.university : null

  // ─── Age and terms ─────────────────────────────────────────────────────
  // One representation covers both: ticking the box says they are 18 or over
  // and agrees to the Terms, Privacy Policy and Cookie Policy. That is how
  // LinkedIn, OpenAI and Handshake do it, and it is the reason we do not ask
  // for a birthday — a date of birth on every account is sensitive data
  // collected to answer one yes/no question, and knowing an age is what
  // creates the duty around minors in the first place.
  //
  // Under 18 is refused, not held. An earlier version saved the profile and
  // opened the account on the eighteenth birthday. It was kinder and it
  // contradicted our own Terms, which say under-18s may not register at all
  // — and a product whose documents disagree with its behaviour has a worse
  // problem than an unbuilt feature.
  //
  // Checked here rather than only in the form, for the same reason as the
  // .edu rule: the route is reachable directly.
  if (profile.age_attested !== true) {
    return NextResponse.json(
      { error: 'You must confirm you are 18 or over and agree to the Terms, Privacy Policy and Cookie Policy.' },
      { status: 400 },
    )
  }

  const now = new Date().toISOString()

  // Insert, not upsert. A duplicate here means two requests raced, and the
  // loser must not overwrite the winner's roles.
  //
  // A faculty account opens straight away. `faculty_requested_at` records
  // that the claim is waiting on a person, and `faculty_verified_at` stays
  // null until one confirms it — which is what the pending badge reads.
  const { error: accountErr } = await admin.from('accounts').insert({
    id: user.id,
    roles: [role],
    faculty_requested_at: role === 'faculty' ? now : null,
    display_name: displayName,
    institution,
    // Recorded separately from the terms: if the terms are amended and
    // re-accepted later, when they told us they were an adult must not
    // silently move to the new date.
    age_attested_at: now,
    terms_accepted_at: now,
    terms_version: TERMS_VERSION,
    heard_about: heardAbout,
    heard_about_detail: heardAboutDetail,
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
    // The attestation is a fact about the account, not part of the profile
    // the scanner, matcher and public record read.
    const { age_attested: _attested, ...studentProfile } = profile

    const { error: profileErr } = await admin.from('students').insert({
      id: user.id,
      ...studentProfile,
      edu_domain: user.email?.split('@')[1] ?? null,
      edu_verified_at: now,
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
