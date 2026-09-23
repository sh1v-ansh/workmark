import { createClient } from '@/lib/supabase/server'
import { enforce } from '@/lib/rate-limit'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { consentFieldsForSignup } from '@/lib/notify/marketing'
import { record } from '@/lib/analytics/record'
import { cleanIntents } from '@/lib/profile/intents'

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

  let body: { role?: string; profile?: Record<string, unknown>; heardAbout?: unknown; heardAboutDetail?: unknown; marketingOptIn?: unknown; analyticsSessionId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 400 })
  }

  // Narrowed rather than trusted. 'admin' can never arrive this way — the
  // only route to it is somebody running scripts/grant-role.mjs with the
  // service key.
  const role = body.role === 'faculty' ? 'faculty' : 'student'
  // An array or a string here would read every field as undefined, which
  // looks downstream like a form somebody left blank rather than a
  // malformed request.
  const rawProfile = body.profile
  const profile: Record<string, unknown> =
    rawProfile && typeof rawProfile === 'object' && !Array.isArray(rawProfile)
      ? (rawProfile as Record<string, unknown>)
      : {}

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
    // Strict === true, not truthy. A missing field, a string "false" from a
    // hand-rolled request, or anything else at all has to read as "did not
    // agree" — this is the one field where being generous about the input
    // means sending marketing to somebody who never said yes.
    ...consentFieldsForSignup(body.marketingOptIn === true),
    // Students have two more screens; faculty have none. Recorded so a
    // student who closes the tab now comes back to the screen they stopped
    // at rather than being sent to a dashboard mid-setup.
    onboarding_step: role === 'student' ? 'intents' : null,
  })

  if (!accountErr) {
    // The end of the signup funnel. Recorded here rather than from the
    // browser because this is the moment the account actually exists —
    // a client-side event would fire before the write it is claiming.
    void record(admin, 'onboarding_completed', user.id, { role })
  }

  if (accountErr) {
    if (accountErr.code === '23505') {
      return NextResponse.json(
        { error: 'This account has already been set up.', alreadyOnboarded: true },
        { status: 409 },
      )
    }
    console.error('[api/onboarding] account write failed:', accountErr)
    return NextResponse.json(
      { error: 'Could not create your account.', ref: dbRef(accountErr) },
      { status: 500 },
    )
  }

  // Students get the profile the scanner, the matcher and the public record
  // all read. Faculty get nothing here on purpose — their name and
  // institution are on the account row above, and a professor in `students`
  // is a professor in the student directory and the matching pool.
  if (role === 'student') {
    // The attestation is a fact about the account, not part of the profile
    // the scanner, matcher and public record read.
    const { age_attested: _attested, ...studentProfile } = profile
    // Strictly boolean: this gates paid roles, so anything but a real true
    // reads as "not on a visa" only when the form genuinely said no.
    studentProfile.is_international = profile.is_international === true
    delete studentProfile.visa_type

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
      return NextResponse.json(
        { error: 'Could not save your profile.', ref: dbRef(profileErr) },
        { status: 500 },
      )
    }
  }

  // Stitch this tab's earlier events (opened signup, signed in, onboarding
  // started) to the student, so the funnel follows one person rather than a
  // session that becomes an account. Only rows with no student yet, and
  // only this session: a session id is not secret, but claiming somebody
  // else's anonymous page views would gain nothing.
  if (role === 'student' && typeof body.analyticsSessionId === 'string' && body.analyticsSessionId) {
    const { error: stitchErr } = await admin
      .from('events')
      .update({ student_id: user.id })
      .eq('session_id', body.analyticsSessionId.slice(0, 64))
      .is('student_id', null)
    if (stitchErr) console.error('[api/onboarding] event stitch failed:', stitchErr.message)
  }

  return NextResponse.json({ ok: true, role, verificationPending: role === 'faculty' })
}

/**
 * PATCH /api/onboarding — the screens after the account exists.
 *
 * ── Why the route had to split ────────────────────────────────────────────
 * POST was everything or nothing: one submit carrying eighteen fields, and a
 * student who closed the tab halfway had no account, no row and nothing to
 * come back to. They started again from the first field.
 *
 * So the account is created by POST after the first screen — the one
 * carrying the identity and the terms, which are the two things that have to
 * be true before an account may exist at all — and everything after it lands
 * here.
 *
 * ── What deliberately cannot be changed here ──────────────────────────────
 * The role. POST refuses a second run precisely because self-declaring
 * yourself faculty is only defensible as a signup-time decision; letting
 * PATCH touch `roles` would hand that back. Same for the terms and age
 * timestamps, which are a record of a moment rather than settings.
 *
 * This route writes profile fields and nothing else.
 */
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const limited = await enforce('profile', user.id)
  if (limited) return limited

  let body: { intents?: unknown; step?: unknown; details?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 400 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // No account means POST has not run, so there is nothing to patch. Said
  // plainly rather than silently doing nothing, because a client that gets
  // "ok" for a write that did not happen is the hardest kind of bug to see.
  const { data: account } = await admin
    .from('accounts')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()
  if (!account) {
    return NextResponse.json({ error: 'Finish the first step before this one.' }, { status: 409 })
  }

  // Where they got to, so an interrupted signup resumes rather than
  // restarting. Written even when nothing else in the body is valid — the
  // step is the part that makes the next visit cheap.
  if (typeof body.step === 'string' && body.step.length <= 40) {
    await admin
      .from('accounts')
      .update({ onboarding_step: body.step === 'done' ? null : body.step })
      .eq('id', user.id)
  }

  if (body.intents !== undefined) {
    const intents = cleanIntents(body.intents)
    const { error } = await admin.from('students').update({ intents }).eq('id', user.id)
    if (error) {
      console.error('[api/onboarding] intents write failed:', error)
      return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
    }
    void record(admin, 'onboarding_intents_chosen', user.id, { count: intents.length })
  }

  // The fields taken out of signup: asked after the first scan instead, when
  // somebody has seen what the record is for. Every one is optional and
  // editable, because nothing is ranked on them — unlike graduation year and
  // university, which stay out of reach here on purpose.
  if (body.details !== undefined) {
    const details = cleanDetails(body.details)
    if (typeof details === 'string') {
      return NextResponse.json({ error: details }, { status: 400 })
    }
    if (Object.keys(details).length > 0) {
      const { error } = await admin.from('students').update(details).eq('id', user.id)
      if (error) {
        console.error('[api/onboarding] details write failed:', error)
        return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ ok: true })
}

/**
 * The deferred profile fields, narrowed. A string return is the reason to
 * refuse; an object is what to write. Unknown keys are dropped rather than
 * refused, and there is deliberately no way to reach graduation_year or
 * university through here.
 */
function cleanDetails(raw: unknown): Record<string, string | number | null> | string {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'Invalid details.'
  const input = raw as Record<string, unknown>
  const out: Record<string, string | number | null> = {}

  const text = (v: unknown, max: number) => {
    if (v === null || v === '') return null
    if (typeof v !== 'string') return undefined
    const t = v.trim()
    return t ? t.slice(0, max) : null
  }

  if ('major' in input) {
    const v = text(input.major, 120)
    if (v !== undefined) out.major = v
  }
  if ('availability' in input) {
    if (input.availability === null || input.availability === '') out.availability = null
    else if (input.availability === 'full-time' || input.availability === 'part-time') out.availability = input.availability
    else return 'Availability should be full-time or part-time.'
  }
  if ('hours_per_week' in input) {
    const v = input.hours_per_week
    if (v === null || v === '') out.hours_per_week = null
    else {
      const n = typeof v === 'number' ? v : Number(v)
      if (!Number.isInteger(n) || n < 1 || n > 60) return 'Hours per week should be between 1 and 60.'
      out.hours_per_week = n
    }
  }
  if ('linkedin_url' in input) {
    const v = text(input.linkedin_url, 300)
    if (v !== undefined) {
      // Only a LinkedIn address, because this is rendered as a link on a
      // public profile and anything else is a link we would be vouching for.
      if (v !== null && !/^https:\/\/(www\.)?linkedin\.com\//i.test(v)) {
        return 'That should be a linkedin.com address, starting with https://.'
      }
      out.linkedin_url = v
    }
  }
  return out
}

/**
 * Which database rule refused the write, in a form that can be sent back.
 *
 * Signup is the one route where a failure means somebody cannot get in at
 * all, and it failed with a bare "could not create your account" that said
 * nothing about why — while the logged detail was only in a server log that
 * was hard to find at the moment it mattered. The Postgres code and the name
 * of the constraint or column are enough to fix it, and neither is anything
 * a user could use against us: they describe the rule, not anybody's data.
 */
function dbRef(err: { code?: string; message?: string }): string {
  const code = err.code ?? 'unknown'
  // Postgres quotes names with "…"; PostgREST's PGRST204 ("Could not find
  // the 'x' column of 'y'") uses '…'.
  const named = err.message?.match(/(?:constraint|column) "([^"]+)"|the '([^']+)' column/)
  const name = named?.[1] ?? named?.[2]
  return name ? `${code}:${name}` : code
}
