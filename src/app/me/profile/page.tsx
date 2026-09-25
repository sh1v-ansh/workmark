import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * /me/profile: your own profile as others see it. The navbar only knows
 * the name, so this picks the public link if there is one, else /people/id.
 */
export default async function MyProfileRedirect() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: student } = await supabase.from('students').select('handle').eq('id', user.id).maybeSingle()
  if (!student) redirect('/onboarding')
  redirect(student.handle ? `/p/${student.handle}` : `/people/${user.id}`)
}
