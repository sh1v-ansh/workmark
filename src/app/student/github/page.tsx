import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import GithubScanClient from './GithubScanClient'

/**
 * Minimal, standalone verification page for the Phase 1 scan pipeline —
 * deliberately NOT integrated into the main student dashboard, which
 * still runs on pre-rebuild types and is due for a full rewrite in
 * Phase 2+. This page only needs to prove the pipeline works end to end;
 * the polished version of this data belongs on /me (Phase 7).
 */
export default async function GithubScanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: student } = await supabase.from('students').select('id, full_name').eq('id', user.id).maybeSingle()
  if (!student) redirect('/onboarding')

  const [
    { data: connection, error: connectionError },
    { data: grants, error: grantsError },
    { data: priors, error: priorsError },
    { data: evidenceRows, error: evidenceError },
  ] = await Promise.all([
    supabase.from('github_connections').select('*').eq('student_id', user.id).maybeSingle(),
    supabase.from('github_repo_grants').select('*').eq('student_id', user.id).is('revoked_at', null).order('granted_at', { ascending: false }),
    supabase.from('skill_priors').select('*, skills(canonical_name)').eq('student_id', user.id).order('extracted_at', { ascending: false }),
    // Deliberately NOT embedding skills(canonical_name) here — current_skill_evidence
    // is a VIEW, and PostgREST's embed resolution through views is unreliable (it
    // depends on the schema cache tracing the FK through the view's dependency
    // chain, which isn't guaranteed the same way it is for a base table). A failed
    // embed comes back as an error, and errors here were silently swallowed by
    // `?? []` below, which is exactly the "scan reports success, page shows
    // nothing" symptom this was rewritten to stop hiding. Joining skill names
    // manually below sidesteps the embed entirely.
    supabase.from('current_skill_evidence').select('*').eq('student_id', user.id).order('created_at', { ascending: false }),
  ])

  for (const [label, error] of [
    ['github_connections', connectionError],
    ['github_repo_grants', grantsError],
    ['skill_priors', priorsError],
    ['current_skill_evidence', evidenceError],
  ] as const) {
    if (error) console.error(`[student/github] ${label} query failed:`, error)
  }

  // Diagnostic: compare the view's row count against the base table's row
  // count for the same student. If the base table has rows the view
  // doesn't, the bug is in current_skill_evidence's "not superseded"
  // filter (a corrects_evidence_id chain excluding rows it shouldn't); if
  // they match at zero, the writes themselves aren't landing under this
  // student_id. Temporary — remove once the scan/evidence-display gap is
  // confirmed fixed.
  const { count: rawEvidenceCount, error: rawCountError } = await supabase
    .from('skill_evidence')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', user.id)
  console.log('[student/github] diagnostic', {
    userId: user.id,
    hasConnection: !!connection,
    grantsCount: grants?.length ?? 0,
    priorsCount: priors?.length ?? 0,
    viewEvidenceCount: evidenceRows?.length ?? 0,
    rawSkillEvidenceCount: rawEvidenceCount ?? null,
    rawCountError: rawCountError ?? null,
  })

  type EvidenceRow = NonNullable<typeof evidenceRows>[number] & { skills: { canonical_name: string } | null }
  let evidence: EvidenceRow[] = []
  if (evidenceRows && evidenceRows.length > 0) {
    const skillIds = Array.from(new Set(evidenceRows.map((r) => r.skill_id)))
    const { data: skillRows, error: skillsError } = await supabase.from('skills').select('id, canonical_name').in('id', skillIds)
    if (skillsError) console.error('[student/github] skills lookup failed:', skillsError)
    const nameById = new Map((skillRows ?? []).map((s) => [s.id, s.canonical_name]))
    evidence = evidenceRows.map((r) => ({ ...r, skills: nameById.has(r.skill_id) ? { canonical_name: nameById.get(r.skill_id)! } : null }))
  }

  return (
    <GithubScanClient
      studentName={student.full_name}
      connection={connection}
      grants={grants ?? []}
      priors={priors ?? []}
      evidence={evidence}
    />
  )
}
