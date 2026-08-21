import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { agentsAvailable } from '@/lib/agents/client'
import BriefsClient, { type BriefRow } from './BriefsClient'

/**
 * /me/briefs — private project ideas.
 *
 * Never listings, never visible to anyone else, never evidence.
 * Completing one produces a repo, and the repo produces evidence through
 * the ordinary scan — the same path as any other project.
 */
export default async function BriefsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: student } = await supabase.from('students').select('full_name').eq('id', user.id).maybeSingle()
  if (!student) redirect('/onboarding')

  const [{ data: briefs }, { data: taxonomy }, { data: evidence }, { data: grants }] = await Promise.all([
    supabase
      .from('project_briefs')
      .select('id, target_skill_id, target_role, brief_text, difficulty, skill_level, career_track, repo_full_name, started_at, issued_at, completed_at')
      .eq('student_id', user.id)
      .order('issued_at', { ascending: false }),
    supabase.from('skills').select('id, canonical_name, parent_id').is('deprecated_at', null).order('canonical_name'),
    supabase.from('current_skill_evidence').select('skill_id').eq('student_id', user.id),
    // For the repo picker when starting a brief — a repo can only be
    // linked if it's already granted, so this is the whole candidate set.
    supabase
      .from('github_repo_grants')
      .select('repo_full_name, is_private')
      .eq('student_id', user.id)
      .is('revoked_at', null)
      .order('repo_full_name'),
  ])

  const nameById = new Map((taxonomy ?? []).map((s) => [s.id, s.canonical_name]))
  const evidencedSkillIds = new Set((evidence ?? []).map((e) => e.skill_id))

  const rows: BriefRow[] = (briefs ?? []).map((b) => {
    // brief_text is stored as "Title\n\nBody" — the title is the first
    // line, so it survives without a separate column.
    const [title, ...rest] = b.brief_text.split('\n\n')
    return {
      id: b.id,
      title: title ?? 'Project idea',
      body: rest.join('\n\n'),
      targetSkillId: b.target_skill_id,
      targetSkillName: b.target_skill_id ? (nameById.get(b.target_skill_id) ?? b.target_skill_id) : null,
      targetRole: b.target_role,
      difficulty: b.difficulty,
      skillLevel: b.skill_level,
      careerTrack: b.career_track,
      repoFullName: b.repo_full_name,
      startedAt: b.started_at,
      issuedAt: b.issued_at,
      completedAt: b.completed_at,
    }
  })

  return (
    <BriefsClient
      studentName={student.full_name}
      briefs={rows}
      taxonomy={(taxonomy ?? []).filter((s) => s.parent_id !== null).map((s) => ({
        id: s.id,
        canonicalName: s.canonical_name,
        alreadyEvidenced: evidencedSkillIds.has(s.id),
      }))}
      agentsAvailable={agentsAvailable()}
      grantedRepos={(grants ?? []).map((g) => ({ repoFullName: g.repo_full_name, isPrivate: g.is_private }))}
    />
  )
}
