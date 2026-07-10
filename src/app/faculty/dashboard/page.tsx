import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import FacultyDashboardClient from './FacultyDashboardClient'
import FacultyPendingScreen from './FacultyPendingScreen'
import type { Application, GithubEvidencedSkill } from '@/lib/types'

export default async function FacultyDashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: faculty } = await supabase
    .from('faculty')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (!faculty) redirect('/onboarding')

  if (!faculty.is_approved) return <FacultyPendingScreen faculty={faculty} />

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('poster_id', user.id)
    .eq('poster_type', 'faculty')
    .order('created_at', { ascending: false })

  const projectIds = (projects ?? []).map((p) => p.id)
  let applications: Application[] = []
  let githubSkillsByStudent: Record<string, GithubEvidencedSkill[]> = {}
  if (projectIds.length > 0) {
    const { data } = await supabase
      .from('applications')
      .select('*, students(full_name, university, gpa, skills, resume_url)')
      .in('project_id', projectIds)
      .order('created_at', { ascending: false })
    applications = (data ?? []) as Application[]

    const studentIds = Array.from(new Set(applications.map((a) => a.student_id)))
    if (studentIds.length > 0) {
      const { data: ghSkills } = await supabase
        .from('github_evidenced_skills')
        .select('*')
        .in('student_id', studentIds)
        .order('evidence_count', { ascending: false })
      for (const s of (ghSkills ?? []) as GithubEvidencedSkill[]) {
        (githubSkillsByStudent[s.student_id] ||= []).push(s)
      }
    }
  }

  return (
    <FacultyDashboardClient
      faculty={faculty}
      initialProjects={projects ?? []}
      initialApplications={applications}
      githubSkillsByStudent={githubSkillsByStudent}
    />
  )
}
