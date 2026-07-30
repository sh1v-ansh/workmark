import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StudentsDirectoryClient from './StudentsDirectoryClient'

export default async function StudentsDirectoryPage() {
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

  const { data: directory } = await supabase
    .from('students')
    .select('id, full_name, university, major, degree_type, graduation_year, skills, availability, github_url, linkedin_url')
    .eq('open_to_collab', true)
    .neq('id', user.id)
    .order('created_at', { ascending: false })

  return <StudentsDirectoryClient student={student} directory={directory ?? []} />
}
