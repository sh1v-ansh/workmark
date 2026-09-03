import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DeleteClient } from './DeleteClient'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Delete your account · Workmark' }

export default async function DeleteAccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Warned about, not blocked. Someone with a project in flight still gets
  // to leave — they just deserve to know the other side loses the record.
  const { count } = await supabase
    .from('engagements')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', user.id)
    .in('stage', ['accepted', 'in_progress', 'submitted'])

  return <DeleteClient liveEngagements={count ?? 0} />
}
