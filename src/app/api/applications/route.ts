import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getStudentDepth } from '@/lib/matching/depth'
import { getListingRequirements } from '@/lib/matching/listing'
import { computeFit } from '@/lib/matching/fit'

// Versioned so a consent record says which wording was actually agreed to.
// Changing the text below REQUIRES bumping this — an FCRA consent that
// can't be tied to specific wording is not much of a consent record.
const CONSENT_VERSION = 'application_disclosure_v1'

/**
 * POST /api/applications
 *
 * Applying is the moment a student's verified record gets disclosed to a
 * third party, which makes it the FCRA-load-bearing write path in MVP.
 * Three things happen together and are meant to stay together:
 *
 *   1. consents      — explicit, versioned, scoped permission to disclose.
 *   2. applications  — including fit_tier_at_apply / rank_score_at_apply /
 *                      computed_snapshot, freezing what the matching engine
 *                      actually saw. Depth moves as evidence accumulates,
 *                      so "why was I ranked third in March" is unanswerable
 *                      later without this.
 *   3. disclosure_log— what was furnished, to whom, with the values
 *                      themselves in payload_snapshot (not just field
 *                      names — a dispute is a claim that a specific value
 *                      was wrong).
 *
 * consents is inserted under the student's own session (it has a
 * self-insert policy, and consent genuinely is the student's act). The
 * application and disclosure_log go through service-role: the application
 * carries computed fields the student must not be able to author, and
 * disclosure_log has no user insert policy at all by design.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  let body: { listingId?: string; responseText?: string; consented?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const listingId = body.listingId
  if (!listingId) return NextResponse.json({ error: 'Missing listing.' }, { status: 400 })
  if (!body.consented) {
    return NextResponse.json({ error: 'Consent is required to share your verified record with this poster.' }, { status: 400 })
  }

  const { data: listing } = await supabase
    .from('listings')
    .select('id, poster_id, status')
    .eq('id', listingId)
    .maybeSingle()
  if (!listing) return NextResponse.json({ error: 'Listing not found.' }, { status: 404 })
  if (listing.status !== 'open') return NextResponse.json({ error: 'This listing is no longer open.' }, { status: 400 })
  if (listing.poster_id === user.id) {
    return NextResponse.json({ error: "You can't apply to your own listing." }, { status: 400 })
  }

  // Compute fit from the same code the browse/detail pages use, so what
  // the student was shown before submitting is what gets frozen here.
  const [depth, requirementsByListing] = await Promise.all([
    getStudentDepth(supabase, user.id),
    getListingRequirements(supabase, [listingId]),
  ])
  const requirements = requirementsByListing.get(listingId) ?? []
  const fit = computeFit(requirements, depth)

  const consentPayload = {
    student_id: user.id,
    scope: 'application_disclosure',
    text_version: CONSENT_VERSION,
  }
  const { data: consent, error: consentErr } = await supabase
    .from('consents')
    .insert(consentPayload)
    .select('id')
    .single()
  if (consentErr) {
    console.error('[api/applications] consent insert failed:', consentErr)
    return NextResponse.json({ error: 'Could not record your consent.' }, { status: 500 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const snapshot = {
    computed_at: new Date().toISOString(),
    requirements: requirements.map((r) => ({ skill_id: r.skillId, required_level: r.requiredLevel })),
    per_skill: fit.perSkill,
    missing_skill_ids: fit.missingSkillIds,
    fit_tier: fit.tier,
    rank_score: fit.rankScore,
    // Every skill the student had evidence in at submission time, not just
    // the ones this listing asked for — a dispute about "you said my depth
    // was X" needs the whole picture as of that moment, not a filtered view.
    depth_by_skill: Object.fromEntries(
      Array.from(depth.entries()).map(([skillId, d]) => [skillId, { depth: d.depth, best_level: d.bestLevel, artifact_count: d.artifactCount }]),
    ),
  }

  const { data: application, error: appErr } = await admin
    .from('applications')
    .insert({
      listing_id: listingId,
      student_id: user.id,
      consent_id: consent.id,
      response_text: body.responseText?.trim() || null,
      fit_tier_at_apply: fit.tier,
      rank_score_at_apply: fit.rankScore,
      computed_snapshot: snapshot,
      status: 'submitted',
    })
    .select('id')
    .single()
  if (appErr) {
    // 23505 = the (listing_id, student_id) unique constraint.
    if (appErr.code === '23505') {
      return NextResponse.json({ error: "You've already applied to this listing." }, { status: 409 })
    }
    console.error('[api/applications] application insert failed:', appErr)
    return NextResponse.json({ error: 'Could not submit your application.' }, { status: 500 })
  }

  const { error: logErr } = await admin.from('disclosure_log').insert({
    student_id: user.id,
    recipient_id: listing.poster_id,
    fields_disclosed: ['fit_tier', 'rank_score', 'per_skill_depth', 'missing_skills'],
    payload_snapshot: snapshot,
  })
  if (logErr) {
    // The disclosure already happened — the application row is what makes
    // it visible to the poster. Failing to log it is a compliance gap, so
    // it's loud in the logs rather than silently swallowed, but rolling
    // the application back would be worse for the student.
    console.error('[api/applications] disclosure_log insert FAILED — disclosure occurred unlogged:', logErr)
  }

  return NextResponse.json({ ok: true, id: application.id, fitTier: fit.tier })
}
