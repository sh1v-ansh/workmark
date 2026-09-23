import { redirect } from 'next/navigation'
import { EMPTY_ELIGIBILITY } from '@/lib/profile/eligibility'
import { createClient } from '@/lib/supabase/server'
import { EMAIL_KINDS, type EmailKind } from '@/lib/notify/prefs'
import SettingsClient from './SettingsClient'
import { mayEmail } from '@/lib/notify/marketing'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Settings' }

/**
 * Confirms what a one-click unsubscribe just did.
 *
 * The link in the email turns the setting off before this page renders, so
 * this is a receipt rather than a form to submit. Someone who clicked it by
 * accident can put it back one section down.
 *
 * Moved here from /account/notifications along with the rest of the email
 * settings; that route still exists and forwards, because these links are
 * sitting in mail that has already been delivered and will keep arriving for
 * as long as anyone keeps an old email.
 */
function noticeFor(off: string | undefined, stale: string | undefined): string | null {
  if (stale) return 'That unsubscribe link had expired, so nothing changed. You can set your preferences here.'
  if (off === 'all') return "Done — every optional email is off. You'll still get the answer to applications you send."
  if (off && off in EMAIL_KINDS) return `Done — you won't get "${EMAIL_KINDS[off as EmailKind].label}" emails any more.`
  return null
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { off?: string; stale?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: student }, { data: account }, { data: connection }, { data: eligibility }] = await Promise.all([
    supabase
      .from('students')
      .select('full_name, university, major, degree_type, graduation_year, github_username, is_international')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('accounts')
      .select('notification_prefs, email_unsubscribed_at, marketing_opted_in_at, marketing_opted_out_at')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('github_connections')
      .select('github_login, connected_at')
      .eq('student_id', user.id)
      .maybeSingle(),
    // Owner-only table; this is the student reading their own answers.
    supabase
      .from('student_eligibility')
      .select('use_for_opportunities, first_gen, military, gender, gender_self, race_ethnicity, disability, lgbtq, low_income, us_state, transfer, citizenship')
      .eq('student_id', user.id)
      .maybeSingle(),
  ])

  return (
    <SettingsClient
      email={user.email ?? null}
      profile={{
        fullName: student?.full_name ?? '',
        university: student?.university ?? '',
        major: student?.major ?? '',
        degreeType: student?.degree_type ?? '',
        graduationYear: student?.graduation_year ?? null,
        isInternational: student?.is_international ?? false,
      }}
      hasStudentProfile={!!student}
      eligibility={eligibility ? { ...EMPTY_ELIGIBILITY, ...eligibility, race_ethnicity: eligibility.race_ethnicity ?? [] } : EMPTY_ELIGIBILITY}
      github={connection ? { login: connection.github_login, connectedAt: connection.connected_at } : null}
      initialPrefs={(account?.notification_prefs ?? {}) as Record<string, boolean>}
      initialUnsubscribedAll={!!account?.email_unsubscribed_at}
      initialMarketing={mayEmail({ optedInAt: account?.marketing_opted_in_at ?? null, optedOutAt: account?.marketing_opted_out_at ?? null })}
      notice={noticeFor(searchParams.off, searchParams.stale)}
    />
  )
}
