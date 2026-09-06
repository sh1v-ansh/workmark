import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * Email settings moved into /account/settings.
 *
 * This route cannot simply be deleted. Its address is printed in the
 * List-Unsubscribe header and the footer of every email Workmark has ever
 * sent, and those live in people's inboxes for years. Breaking it would mean
 * an unsubscribe link that 404s, which is both rude and, under CAN-SPAM, not
 * an unsubscribe mechanism at all.
 *
 * So it forwards, carrying the receipt parameters through — `off` names the
 * kind that was just switched off, `stale` says the token had expired — so
 * the settings page can still tell the reader what just happened.
 */
export default function NotificationsRedirect({
  searchParams,
}: {
  searchParams: { off?: string; stale?: string }
}) {
  const params = new URLSearchParams()
  if (searchParams.off) params.set('off', searchParams.off)
  if (searchParams.stale) params.set('stale', searchParams.stale)
  const query = params.toString()

  redirect(`/account/settings${query ? `?${query}` : ''}#email`)
}
