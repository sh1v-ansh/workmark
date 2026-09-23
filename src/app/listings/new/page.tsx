import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NewListingClient from './NewListingClient'
import { agentsAvailable } from '@/lib/agents/client'

export const metadata = { title: 'Post' }

export default async function NewListingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Any finished account can post — faculty included, who have no students
  // row by design. Checking for one sent every professor back to onboarding.
  const { data: account } = await supabase.from('accounts').select('id').eq('id', user.id).maybeSingle()
  if (!account) redirect('/onboarding')

  // The full taxonomy, loaded once — it's ~180 fixed rows, so filtering
  // client-side beats a round trip per keystroke.
  const { data: taxonomy } = await supabase
    .from('skills')
    .select('id, canonical_name, parent_id')
    .is('deprecated_at', null)
    .order('canonical_name')

  return <NewListingClient taxonomy={taxonomy ?? []} agentsAvailable={agentsAvailable()} />
}
