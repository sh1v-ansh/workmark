import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
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

  // Check current user early so we know whether to count this as a view
  // (the poster browsing their own listing shouldn't inflate its count).
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser()

  if (!viewer || viewer.id !== project.poster_id) {
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    await admin.from('projects').update({ view_count: project.view_count + 1 }).eq('id', id)
    project.view_count += 1
  }

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

  // (user already fetched above as `viewer`, to decide whether to count the view)
  const user = viewer

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
