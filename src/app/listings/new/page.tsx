import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NewListingClient from './NewListingClient'

export default async function NewListingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: student } = await supabase.from('students').select('full_name').eq('id', user.id).maybeSingle()
  if (!student) redirect('/onboarding')

  // The full taxonomy, loaded once — it's ~180 fixed rows, so filtering
  // client-side beats a round trip per keystroke.
  const { data: taxonomy } = await supabase
    .from('skills')
    .select('id, canonical_name, parent_id')
    .is('deprecated_at', null)
    .order('canonical_name')

  return <NewListingClient studentName={student.full_name} taxonomy={taxonomy ?? []} />
}
