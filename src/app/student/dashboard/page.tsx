import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StudentDashboardClient from './StudentDashboardClient'
import type { Application, GithubEvidencedSkill } from '@/lib/types'

export default async function StudentDashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (!student) redirect('/onboarding')

  // Applications with project + poster info (poster_display_name denormalized on projects)
  const { data: applications } = await supabase
    .from('applications')
    .select('*, projects(title, poster_id, poster_type, poster_display_name)')
    .eq('student_id', user.id)
    .order('created_at', { ascending: false })

  // ── Peer marketplace: projects this student has posted, and the
  //    collaboration requests received on them ──
  const { data: postedProjects } = await supabase
    .from('projects')
    .select('*')
    .eq('poster_id', user.id)
    .eq('poster_type', 'student')
    .order('created_at', { ascending: false })

  const postedProjectIds = (postedProjects ?? []).map((p) => p.id)
  let receivedRequests: Application[] = []
  let githubSkillsByApplicant: Record<string, GithubEvidencedSkill[]> = {}
  let verifiedSkillsByApplicant: Record<string, string[]> = {}
  if (postedProjectIds.length > 0) {
    const { data } = await supabase
      .from('applications')
      .select('*, students(full_name, university, gpa, skills, resume_url)')
      .in('project_id', postedProjectIds)
      .order('created_at', { ascending: false })
    receivedRequests = (data ?? []) as Application[]

    // GitHub-evidenced (Tier 3) skills for each applicant, same trust signal
    // already shown on the company/faculty dashboards.
    const applicantIds = Array.from(new Set(receivedRequests.map((a) => a.student_id)))
    if (applicantIds.length > 0) {
      const { data: ghSkills } = await supabase
        .from('github_evidenced_skills')
        .select('*')
        .in('student_id', applicantIds)
        .order('evidence_count', { ascending: false })
      for (const s of (ghSkills ?? []) as GithubEvidencedSkill[]) {
        (githubSkillsByApplicant[s.student_id] ||= []).push(s);
        (verifiedSkillsByApplicant[s.student_id] ||= []).push(s.skill.toLowerCase());
      }

      // Tier 1/2 (locked employer/faculty attestations) and locked peer
      // collaborations also count as VERIFIED fit — combined with Tier 3
      // above, this is what ranks the shortlist of applicants.
      const [{ data: vwr }, { data: peers }] = await Promise.all([
        supabase.from('verified_work_records').select('student_id, skills_used').in('student_id', applicantIds).not('locked_at', 'is', null),
        supabase.from('peer_records').select('student_id, skills_used').in('student_id', applicantIds).not('locked_at', 'is', null),
      ])
      for (const row of [...(vwr ?? []), ...(peers ?? [])] as { student_id: string; skills_used: string[] | null }[]) {
        for (const skill of row.skills_used ?? []) {
          (verifiedSkillsByApplicant[row.student_id] ||= []).push(skill.toLowerCase())
        }
      }
      for (const id of Object.keys(verifiedSkillsByApplicant)) {
        verifiedSkillsByApplicant[id] = Array.from(new Set(verifiedSkillsByApplicant[id]))
      }
    }
  }

  // Contact shares and peer-record attestations this student is a party to
  // (either as the applicant on a peer project or as the poster who accepted
  // someone).
  const [{ data: contactShares }, { data: peerRecords }] = await Promise.all([
    supabase.from('contact_shares').select('*').or(`student_id.eq.${user.id},poster_id.eq.${user.id}`),
    supabase.from('peer_records').select('*').or(`student_id.eq.${user.id},poster_id.eq.${user.id}`),
  ])

  // Verified work records
  const { data: experienceRecords } = await supabase
    .from('verified_work_records')
    .select('*')
    .eq('student_id', user.id)
    .order('created_at', { ascending: false })

  // GitHub-evidenced skills + per-repo structural profiles (Tier 3)
  const [{ data: githubSkills }, { data: githubRepos }] = await Promise.all([
    supabase.from('github_evidenced_skills').select('*').eq('student_id', user.id).order('evidence_count', { ascending: false }),
    supabase.from('github_repo_profiles').select('*').eq('student_id', user.id).order('extracted_at', { ascending: false }),
  ])

  return (
    <StudentDashboardClient
      student={student}
      applications={applications ?? []}
      experienceRecords={experienceRecords ?? []}
      githubSkills={githubSkills ?? []}
      githubRepos={githubRepos ?? []}
      postedProjects={postedProjects ?? []}
      receivedRequests={receivedRequests}
      contactShares={contactShares ?? []}
      peerRecords={peerRecords ?? []}
      githubSkillsByApplicant={githubSkillsByApplicant}
      verifiedSkillsByApplicant={verifiedSkillsByApplicant}
    />
  )
}
