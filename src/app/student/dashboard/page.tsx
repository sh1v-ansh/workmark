import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StudentDashboardClient from './StudentDashboardClient'

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
    />
  )
}
