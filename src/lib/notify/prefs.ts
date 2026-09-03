// Who wants which emails.
//
// The rule this encodes: a notification is only worth sending if the
// recipient can act on it, and only worth sending *again* if they haven't
// said stop. Both halves matter — the first keeps the volume low enough
// that the second rarely gets used.

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Every kind of email Workmark sends, and whether someone can switch it off.
 *
 * `essential` is not a loophole for marketing. It means the message is the
 * outcome of something the person did minutes ago and expects an answer to —
 * acceptance and rejection of an application they submitted. Silently
 * dropping those would break the product rather than reduce noise, and
 * CAN-SPAM's transactional exemption is written for exactly this case.
 * Everything else is switchable.
 */
export const EMAIL_KINDS = {
  application_received: {
    label: 'Someone applies to your project',
    detail: 'You posted a project and a student applied.',
    essential: false,
  },
  application_accepted: {
    label: 'You\'re accepted onto a project',
    detail: 'The answer to an application you sent.',
    essential: true,
  },
  application_rejected: {
    label: 'An application wasn\'t taken forward',
    detail: 'The answer to an application you sent. Frees one of your slots.',
    essential: true,
  },
  work_submitted: {
    label: 'A student submits their work',
    detail: 'Someone on your project marked their work done.',
    essential: false,
  },
  engagement_closed: {
    label: 'A project is closed out',
    detail: 'Your work was signed off and skills were added to your record.',
    essential: false,
  },
} as const

export type EmailKind = keyof typeof EMAIL_KINDS

/**
 * Should this person get this email?
 *
 * Fails open. If the preference lookup errors, the mail goes — a database
 * hiccup should not silently swallow the message telling someone they got
 * onto a project. The opposite default would produce a bug nobody can see.
 */
export async function wantsEmail(
  admin: SupabaseClient,
  userId: string,
  kind: EmailKind,
): Promise<boolean> {
  const { data, error } = await admin
    .from('accounts')
    .select('notification_prefs, email_unsubscribed_at')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) return true

  // Unsubscribed from everything still gets the essential ones. Someone who
  // clicks unsubscribe in a "you have an applicant" email has not asked to
  // stop being told the outcome of their own applications.
  if (data.email_unsubscribed_at && !EMAIL_KINDS[kind].essential) return false

  const prefs = (data.notification_prefs ?? {}) as Record<string, boolean>
  // Absent means on, so a newly added kind needs no backfill.
  return prefs[kind] !== false
}
