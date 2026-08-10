import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { canCloseOut, type Stage } from '@/lib/engagements/lifecycle'
import { processRepo } from '@/lib/skills/evidence'

/**
 * POST /api/engagements/[id]/close
 *
 * Close-out — the only path that mints listing-driven evidence (base
 * 0.5), so it's the most consequential write in the product and the one
 * with the most guards:
 *
 *  - only the POSTER may close. The evidence is about the student, so
 *    the student must not be the one deciding it was earned.
 *  - both parties must have agreed to the work description, so the
 *    evidence carries a claim neither side can dispute later.
 *  - the linked repo must be one the student granted AND enabled for
 *    scanning. An engagement is not a back door around the per-repo
 *    consent the picker exists to collect.
 *
 * Service-role because skill_evidence/artifacts/evidence_audit have no
 * user insert policy by design (§10: system-computed, not user input).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  let body: { repoFullName?: string }
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const { data: engagement } = await supabase
    .from('engagements')
    .select('id, student_id, poster_id, stage, description, description_agreed_by_student_at, description_agreed_by_poster_at')
    .eq('id', id)
    .maybeSingle()
  if (!engagement) return NextResponse.json({ error: 'Engagement not found.' }, { status: 404 })

  if (engagement.poster_id !== user.id) {
    return NextResponse.json({ error: 'Only the poster can close out an engagement.' }, { status: 403 })
  }

  const gate = canCloseOut({
    stage: engagement.stage as Stage,
    description: engagement.description,
    description_agreed_by_student_at: engagement.description_agreed_by_student_at,
    description_agreed_by_poster_at: engagement.description_agreed_by_poster_at,
  })
  if (!gate.ok) return NextResponse.json({ error: gate.reason }, { status: 400 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // ── Evidence generation ──
  // Optional: an engagement can legitimately close with no repo (design
  // work, research). It still counts toward track record; it just mints
  // no skill evidence.
  let evidenceResult = null
  if (body.repoFullName) {
    const { data: grant } = await admin
      .from('github_repo_grants')
      .select('id, repo_full_name, scan_enabled')
      .eq('student_id', engagement.student_id)
      .eq('repo_full_name', body.repoFullName)
      .is('revoked_at', null)
      .maybeSingle()

    if (!grant) {
      return NextResponse.json(
        { error: 'That repo is not currently shared with Workmark by the student.' },
        { status: 400 },
      )
    }
    if (!grant.scan_enabled) {
      return NextResponse.json(
        { error: 'The student has not enabled that repo for scanning.' },
        { status: 400 },
      )
    }

    const { data: connection } = await admin
      .from('github_connections')
      .select('installation_id, github_login')
      .eq('student_id', engagement.student_id)
      .maybeSingle()
    if (!connection?.github_login) {
      return NextResponse.json({ error: "The student's GitHub connection is no longer active." }, { status: 400 })
    }

    try {
      evidenceResult = await processRepo(
        admin,
        engagement.student_id,
        connection.installation_id,
        connection.github_login,
        grant.repo_full_name,
        grant.id,
        { engagementId: id },
      )
    } catch (err) {
      console.error('[api/engagements/close] evidence generation failed:', err)
      return NextResponse.json(
        { error: 'Could not read the repo to generate evidence. The engagement was not closed — try again.' },
        { status: 500 },
      )
    }
  }

  // Closed only after evidence succeeded: a closed engagement that minted
  // nothing is silent data loss, whereas a still-submitted one is visibly
  // retryable.
  const { error: closeErr } = await admin
    .from('engagements')
    .update({ stage: 'closed', closed_at: new Date().toISOString() })
    .eq('id', id)
  if (closeErr) {
    console.error('[api/engagements/close] close failed:', closeErr)
    return NextResponse.json({ error: 'Could not close the engagement.' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    evidenceWritten: evidenceResult?.evidenceWritten.length ?? 0,
    skipped: evidenceResult?.skipped ?? false,
    skipReason: evidenceResult?.skipReason,
  })
}
