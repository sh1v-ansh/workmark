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

  // Applications with project + company info
  const { data: applications } = await supabase
    .from('applications')
    .select('*, projects(title, companies(company_name))')
    .eq('student_id', user.id)
    .order('created_at', { ascending: false })

  // Experience records
  const { data: experienceRecords } = await supabase
    .from('experience_records')
    .select('*')
    .eq('student_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <StudentDashboardClient
      student={student}
      applications={applications ?? []}
      experienceRecords={experienceRecords ?? []}
    />
  )
}
