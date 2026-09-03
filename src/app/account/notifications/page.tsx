import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EMAIL_KINDS, type EmailKind } from '@/lib/notify/prefs'
import { NotificationsClient } from './NotificationsClient'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Email settings · Workmark' }

/**
 * Confirms what the one-click unsubscribe just did.
 *
 * The link in an email turns the setting off before this page renders, so
 * this is a receipt rather than a form to submit. Someone who clicked it by
 * accident can put it back here in one click.
 */
function noticeFor(off: string | undefined, stale: string | undefined): string | null {
  if (stale) return 'That unsubscribe link had expired, so nothing changed. You can set your preferences here.'
  if (off === 'all') return 'Done — every optional email is off. You\'ll still get the answer to applications you send.'
  if (off && off in EMAIL_KINDS) return `Done — you won't get "${EMAIL_KINDS[off as EmailKind].label}" emails any more.`
  return null
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: { off?: string; stale?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: account } = await supabase
    .from('accounts')
    .select('notification_prefs, email_unsubscribed_at')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <NotificationsClient
      initialPrefs={(account?.notification_prefs ?? {}) as Record<string, boolean>}
      initialUnsubscribedAll={!!account?.email_unsubscribed_at}
      notice={noticeFor(searchParams.off, searchParams.stale)}
    />
  )
}
