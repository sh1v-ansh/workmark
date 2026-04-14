import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProjectDetailClient from './ProjectDetailClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: project, error } = await supabase
    .from('projects')
    .select('*, companies(company_name, industry, hq_location, website)')
    .eq('id', id)
    .eq('is_open', true)
    .maybeSingle()

  if (error || !project) notFound()

  // Check if current user is a student (so we can show apply button)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let student = null
  let alreadyApplied = false

  if (user) {
    const { data: s } = await supabase
      .from('students')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
    student = s

    if (s) {
      const { data: existing } = await supabase
        .from('applications')
        .select('id')
        .eq('project_id', id)
        .eq('student_id', user.id)
        .maybeSingle()
      alreadyApplied = !!existing
    }
  }

  return (
    <ProjectDetailClient
      project={project}
      student={student}
      alreadyApplied={alreadyApplied}
    />
  )
}
