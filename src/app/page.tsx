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
    // Student-only in MVP — company/faculty accounts are deferred to
    // Tier 1+ and have no table in the v0.5 schema.
    redirect(student ? '/student/dashboard' : '/onboarding')
  }

  return <LandingPage />
}
