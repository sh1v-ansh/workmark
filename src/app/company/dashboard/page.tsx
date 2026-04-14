import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CompanyDashboardClient from './CompanyDashboardClient'

export default async function CompanyDashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (!company) redirect('/onboarding')

  // Fetch all projects for this company
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('company_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch all applications for those projects (with student info)
  const projectIds = (projects ?? []).map((p) => p.id)

  let applications: unknown[] = []
  if (projectIds.length > 0) {
    const { data } = await supabase
      .from('applications')
      .select('*, students(full_name, university, gpa, skills, resume_url)')
      .in('project_id', projectIds)
      .order('created_at', { ascending: false })
    applications = data ?? []
  }

  return (
    <CompanyDashboardClient
      company={company}
      initialProjects={projects ?? []}
      initialApplications={applications}
    />
  )
}
