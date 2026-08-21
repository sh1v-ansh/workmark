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

  // Evidence is written per (student, skill, artifact) — the same skill
  // legitimately gets one row per repo that demonstrates it, each with its
  // own level, since a repo's evidence is independent of any other repo's.
  // That reads as "duplicates" without knowing which repo each row came
  // from, so both skill name AND artifact's repo/deployment are resolved
  // manually here (current_skill_evidence is a VIEW — see prior comment
  // on why embeds aren't used against it).
  type EvidenceRow = NonNullable<typeof evidenceRows>[number] & {
    skills: { canonical_name: string } | null
    artifacts: { repo_full_name: string | null; deployment_url: string | null } | null
  }
  let evidence: EvidenceRow[] = []
  if (evidenceRows && evidenceRows.length > 0) {
    const skillIds = Array.from(new Set(evidenceRows.map((r) => r.skill_id)))
    const artifactIds = Array.from(new Set(evidenceRows.map((r) => r.artifact_id).filter((id): id is string => !!id)))
    const [{ data: skillRows, error: skillsError }, { data: artifactRows, error: artifactsError }] = await Promise.all([
      supabase.from('skills').select('id, canonical_name').in('id', skillIds),
      supabase.from('artifacts').select('id, repo_full_name, deployment_url').in('id', artifactIds),
    ])
    if (skillsError) console.error('[student/github] skills lookup failed:', skillsError)
    if (artifactsError) console.error('[student/github] artifacts lookup failed:', artifactsError)
    const nameById = new Map((skillRows ?? []).map((s) => [s.id, s.canonical_name]))
    const artifactById = new Map((artifactRows ?? []).map((a) => [a.id, a]))
    evidence = evidenceRows.map((r) => ({
      ...r,
      skills: nameById.has(r.skill_id) ? { canonical_name: nameById.get(r.skill_id)! } : null,
      artifacts: r.artifact_id && artifactById.has(r.artifact_id)
        ? { repo_full_name: artifactById.get(r.artifact_id)!.repo_full_name, deployment_url: artifactById.get(r.artifact_id)!.deployment_url }
        : null,
    }))
  }

  // A scan runs in the background now, so it outlives the page. If the
  // student navigated away mid-scan and came back, the page has to pick the
  // job back up — otherwise the scan is silently running with nothing on
  // screen saying so, which is the failure the queue was built to end.
  const { data: activeJob } = await supabase
    .from('jobs')
    .select('id')
    .eq('student_id', user.id)
    .eq('kind', 'github_scan')
    .in('status', ['queued', 'running'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // §3 fallback path: work with no scannable repo. Surfaced here because
  // this is the page where "my work isn't showing up" actually happens.
  const { data: reviewRequests } = await supabase
    .from('review_requests')
    .select('id, url, note, status, requested_at, review_note')
    .eq('student_id', user.id)
    .order('requested_at', { ascending: false })

  return (
    <GithubScanClient
      reviewRequests={reviewRequests ?? []}
      studentName={student.full_name}
      connection={connection}
      grants={grants ?? []}
      priors={priors ?? []}
      evidence={evidence}
      activeJobId={activeJob?.id ?? null}
    />
  )
}
