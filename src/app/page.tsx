import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LandingPage from './LandingPage'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()
    if (student) redirect('/student/dashboard')

    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()
    if (company) redirect('/company/dashboard')

    const { data: faculty } = await supabase
      .from('faculty')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()
    if (faculty) redirect('/faculty/dashboard')

    redirect('/onboarding')
  }

  return <LandingPage />
}
