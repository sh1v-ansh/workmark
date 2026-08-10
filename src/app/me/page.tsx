import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadStudentRecord } from '@/lib/profile/record'
import { suggestHandle } from '@/lib/profile/handle'
import MyRecordClient from './MyRecordClient'

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

  return (
    <MyRecordClient
      record={record}
      sources={sources}
      suggestedHandle={suggestHandle(record.student.fullName, record.student.githubUsername)}
    />
  )
}
