import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail, marketingBlocked } from '@/lib/notify/email'
import { mayEmail } from '@/lib/notify/marketing'

/**
 * Opportunity emails: the marketing mail students opt into at signup
 * ("Send me personalized roles, internships, hackathons and fellowships").
 *
 * Three gates, all required, checked on every send:
 *   1. marketingBlocked() — sender configured and a postal address set
 *      (CAN-SPAM needs it in the footer of anything not transactional);
 *   2. mayEmail() — this person opted in and has not opted out;
 *   3. sendEmail's own preference check (unsubscribed from everything).
 * The 'opportunities' kind puts the postal address and a one-click
 * unsubscribe in every message; unsubscribing withdraws the consent.
 */
export interface OpportunityEmail {
  subject: string
  body: string
  linkUrl?: string | null
  linkLabel?: string | null
}

export async function sendOpportunityEmail(
  admin: SupabaseClient,
  recipient: { id: string; email: string },
  email: OpportunityEmail,
): Promise<'sent' | 'not_opted_in' | 'failed'> {
  const { data: consent } = await admin
    .from('accounts')
    .select('marketing_opted_in_at, marketing_opted_out_at')
    .eq('id', recipient.id)
    .maybeSingle()
  if (!mayEmail({ optedInAt: consent?.marketing_opted_in_at ?? null, optedOutAt: consent?.marketing_opted_out_at ?? null })) {
    return 'not_opted_in'
  }

  // sendEmail builds links from a site path; an absolute URL to an outside
  // opportunity goes in the body instead, so it is never rewritten.
  const internal = email.linkUrl?.startsWith('/') ? email.linkUrl : null
  const body = email.linkUrl && !internal ? `${email.body}\n\n${email.linkUrl}` : email.body

  const ok = await sendEmail({
    to: recipient.email,
    userId: recipient.id,
    kind: 'opportunities',
    subject: email.subject,
    body,
    linkPath: internal ?? undefined,
    linkLabel: internal ? (email.linkLabel ?? 'See it on Workmark') : undefined,
  })
  return ok ? 'sent' : 'failed'
}

/** Everyone who may currently receive opportunity emails, with an address. */
export async function optedInRecipients(admin: SupabaseClient): Promise<{ id: string; email: string }[]> {
  const { data: rows } = await admin
    .from('accounts')
    .select('id, marketing_opted_in_at, marketing_opted_out_at, email_unsubscribed_at, status')
    .not('marketing_opted_in_at', 'is', null)
  const eligible = (rows ?? []).filter((r) =>
    r.status === 'active' && !r.email_unsubscribed_at &&
    mayEmail({ optedInAt: r.marketing_opted_in_at, optedOutAt: r.marketing_opted_out_at }))

  const out: { id: string; email: string }[] = []
  for (const r of eligible) {
    const { data } = await admin.auth.admin.getUserById(r.id)
    if (data?.user?.email) out.push({ id: r.id, email: data.user.email })
  }
  return out
}

export { marketingBlocked }
