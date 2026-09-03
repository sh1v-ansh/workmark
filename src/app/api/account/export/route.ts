import { createClient } from '@/lib/supabase/server'
import { enforce } from '@/lib/rate-limit'
import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/account/export
 *
 * Everything Workmark holds about you, as one JSON file.
 *
 * This is the machine-readable half of a promise the product already makes
 * in two places: FCRA §609 entitles a consumer to their file, and the
 * privacy copy tells people they can ask for a copy. /me/file already shows
 * it on screen — what was missing was the ability to take it away with you,
 * which is the part CCPA and GDPR actually require ("portable" means a file
 * you can hand to someone else, not a page you can scroll).
 *
 * Read under the student's own session, so RLS is what guarantees this is
 * their file and nobody else's. The single service-role read is the login
 * email, which lives in auth.users where the browser cannot reach it — and
 * "what address do you have for me" is squarely part of the answer.
 *
 * Deliberately not included: other people's data. An application carries
 * the listing it went to, not the poster's contact details; a message
 * thread carries what you wrote, not what the other person did. Their side
 * is their file.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const limited = await enforce('export', user.id)
  if (limited) return limited

  const mine = (table: string, columns: string, column = 'student_id') =>
    supabase.from(table).select(columns).eq(column, user.id)

  const [
    account, profile, connection, grants, priors, evidence, audit,
    applications, engagements, briefs, consents, disclosures, disputes,
    messages, artifacts, listings, reviewRequests,
  ] = await Promise.all([
    supabase.from('accounts').select('roles, status, display_name, institution, date_of_birth, terms_accepted_at, terms_version, age_attested_at, notification_prefs, email_unsubscribed_at, created_at').eq('id', user.id).maybeSingle(),
    supabase.from('students').select('*').eq('id', user.id).maybeSingle(),
    mine('github_connections', 'github_username, installation_id, connected_at, last_scanned_at'),
    mine('github_repo_grants', 'repo_full_name, is_private, scan_enabled, rank_score, granted_at, revoked_at'),
    mine('skill_priors', 'skill_id, depth, confidence, source, extracted_at'),
    mine('skill_evidence', '*'),
    mine('evidence_audit', '*'),
    mine('applications', 'id, listing_id, claimed_skills, response_text, fit_tier_at_apply, status, decided_at, created_at'),
    mine('engagements', 'id, listing_id, stage, description, opened_at, submitted_at, closed_at, visibility'),
    mine('project_briefs', '*'),
    mine('consents', 'scope, text_version, granted_at, revoked_at'),
    mine('disclosure_log', 'recipient_id, fields_disclosed, payload_snapshot, furnished_at'),
    mine('disputes', '*'),
    // Only what they wrote. The other side of a conversation is the other
    // side's file, and handing it over here would make every export a way
    // to extract someone else's messages.
    supabase.from('application_messages').select('application_id, body, created_at').eq('sender_id', user.id),
    mine('artifacts', '*'),
    supabase.from('listings').select('*').eq('poster_id', user.id),
    mine('review_requests', '*'),
  ])

  // The login address. Not readable under RLS because it lives in
  // auth.users, and unmistakably part of "what do you hold about me".
  let email: string | null = null
  try {
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data } = await admin.auth.admin.getUserById(user.id)
    email = data?.user?.email ?? null
  } catch (err) {
    console.error('[api/account/export] could not read login email:', err)
  }

  const payload = {
    exported_at: new Date().toISOString(),
    about: 'Everything Workmark holds about you. Other people\'s data is deliberately excluded — an application shows the project you applied to, not the poster\'s details.',
    account: { id: user.id, email, ...(account.data ?? {}) },
    profile: profile.data ?? null,
    github: {
      connection: connection.data?.[0] ?? null,
      repositories_granted: grants.data ?? [],
    },
    skill_record: {
      priors: priors.data ?? [],
      evidence: evidence.data ?? [],
      // Every change ever made to the evidence above, including corrections
      // and retractions. The history is the point of a file, not the
      // current summary.
      audit_trail: audit.data ?? [],
    },
    work: {
      applications: applications.data ?? [],
      engagements: engagements.data ?? [],
      listings_you_posted: listings.data ?? [],
      messages_you_sent: messages.data ?? [],
      artifacts: artifacts.data ?? [],
      project_briefs: briefs.data ?? [],
    },
    your_rights_record: {
      consents: consents.data ?? [],
      // Who we told what about you, and the exact values furnished.
      disclosures: disclosures.data ?? [],
      disputes: disputes.data ?? [],
      review_requests: reviewRequests.data ?? [],
    },
  }

  const stamp = new Date().toISOString().slice(0, 10)

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="workmark-export-${stamp}.json"`,
      // Never cached anywhere. This is the most sensitive response the
      // application produces.
      'Cache-Control': 'no-store, private',
    },
  })
}
