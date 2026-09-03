import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasGithubConsent } from '@/lib/github/consent'
import { ConsentClient } from './ConsentClient'

export const dynamic = 'force-dynamic'

/**
 * The gate in front of /api/github/app/install.
 *
 * Everything that offers to connect GitHub links to the install route, and
 * that route now bounces here first, so this is the one place the wording
 * lives — a link added later can't accidentally skip it.
 */
export default async function GithubConsentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: student } = await supabase.from('students').select('id').eq('id', user.id).maybeSingle()
  if (!student) redirect('/onboarding')

  return <ConsentClient alreadyConsented={await hasGithubConsent(supabase, user.id)} />
}
