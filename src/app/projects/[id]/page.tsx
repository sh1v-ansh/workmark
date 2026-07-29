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
    .select('*')
    .eq('id', id)
    .eq('is_open', true)
    .maybeSingle()

  if (error || !project) notFound()

  // Load poster metadata separately (polymorphic FK).
  let posterMeta: { name: string | null; industry: string | null; location: string | null; website: string | null } | null = null
  if (project.poster_type === 'company') {
    const { data: c } = await supabase
      .from('companies')
      .select('company_name, industry, hq_location, website')
      .eq('id', project.poster_id)
      .maybeSingle()
    if (c) posterMeta = { name: c.company_name, industry: c.industry, location: c.hq_location, website: c.website }
  } else if (project.poster_type === 'faculty') {
    const { data: f } = await supabase
      .from('faculty')
      .select('full_name, institution, department')
      .eq('id', project.poster_id)
      .maybeSingle()
    if (f) posterMeta = { name: f.full_name, industry: f.department, location: f.institution, website: null }
  } else if (project.poster_type === 'student') {
    const { data: s } = await supabase
      .from('students')
      .select('full_name, university, major')
      .eq('id', project.poster_id)
      .maybeSingle()
    if (s) posterMeta = { name: s.full_name, industry: s.major, location: s.university, website: null }
  }

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
      posterMeta={posterMeta}
      student={student}
      alreadyApplied={alreadyApplied}
    />
  )
}
