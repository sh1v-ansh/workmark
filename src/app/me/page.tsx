import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadStudentRecord } from '@/lib/profile/record'
import { loadAcrossProjects } from '@/lib/workspace/across'
import { suggestHandle } from '@/lib/profile/handle'
import MyRecordClient from './MyRecordClient'
import { loadCareer } from '@/lib/careers/load'
import { lastScanFinishedAt } from '@/lib/github/last-scan'

export const metadata = { title: 'Record' }

/**
 * /me — the student's own complete record.
 *
 * Everything, unredacted: hidden engagements included, per-repo
 * artifacts included, the lot. Loaded through the student's own session,
 * so RLS is what guarantees this only ever shows their data.
 */
export default async function MyRecordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const record = await loadStudentRecord(supabase, user.id)
  if (!record) redirect('/onboarding')

  // Which repo each skill came from — the answer to "why does my record
  // say Cryptography", which is otherwise unanswerable from a list of
  // skill names.
  const { data: evidenceRows } = await supabase
    .from('current_skill_evidence')
    .select('skill_id, difficulty_cleared, verification_method, artifact_id, engagement_id')
    .eq('student_id', user.id)

  // Rescan lives on this page now, so this page has to know whether there is
  // anything to rescan and when it last happened. Both are single indexed
  // reads and they run alongside each other rather than in sequence.
  const levels = new Map(record.skills.map((s) => [s.skillId, s.bestLevel]))
  const [{ data: connection }, lastScannedAt, career] = await Promise.all([
    supabase.from('github_connections').select('student_id').eq('student_id', user.id).maybeSingle(),
    lastScanFinishedAt(supabase, user.id),
    loadCareer(supabase, user.id, levels),
  ])

  const artifactIds = Array.from(new Set((evidenceRows ?? []).map((r) => r.artifact_id).filter((id): id is string => !!id)))
  const { data: artifactRows } = artifactIds.length
    ? await supabase.from('artifacts').select('id, repo_full_name, tier, deployment_url').in('id', artifactIds)
    : { data: [] as { id: string; repo_full_name: string | null; tier: string; deployment_url: string | null }[] }
  const artifactById = new Map((artifactRows ?? []).map((a) => [a.id, a]))

  const skillNameById = new Map(record.skills.map((s) => [s.skillId, s.name]))

  const sources = (evidenceRows ?? []).map((r) => {
    const artifact = r.artifact_id ? artifactById.get(r.artifact_id) : null
    return {
      skillId: r.skill_id,
      skillName: skillNameById.get(r.skill_id) ?? r.skill_id,
      level: r.difficulty_cleared,
      repoFullName: artifact?.repo_full_name ?? null,
      tier: artifact?.tier ?? null,
      deploymentUrl: artifact?.deployment_url ?? null,
      verificationMethod: r.verification_method,
      fromEngagement: !!r.engagement_id,
    }
  })

  // How they work, pooled across every project. Null for somebody who has
  // not been on one, and the panel is then not rendered at all rather than
  // shown empty — a card of "not enough yet" reads as the product being
  // broken rather than as them being new.
  const howYouWork = await loadAcrossProjects(supabase, user.id)

  return (
    <MyRecordClient
      career={career}
      studentId={user.id}
      howYouWork={howYouWork}
      record={record}
      sources={sources}
      suggestedHandle={suggestHandle(record.student.fullName, record.student.githubUsername)}
      githubConnected={!!connection}
      lastScannedAt={lastScannedAt}
    />
  )
}
