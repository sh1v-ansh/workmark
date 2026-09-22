import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAccount, hasRole } from '@/lib/auth/roles'
import { emailStatus, marketingBlocked } from '@/lib/notify/email'
import { renderEmail } from '@/lib/notify/template'

/**
 * POST /api/admin/test-email — send one message to the admin asking.
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 * Mail is the one part of this product that cannot be tested by looking at
 * it. Every send is best-effort and returns a boolean nobody reads, so
 * "notifications are not working" has been a guess rather than a fact —
 * the key, the sender address, the DNS records and the template are four
 * separate things that each break the same way, silently.
 *
 * This sends a real message through the real path and hands back what
 * Resend actually said, including the response body on a failure. That is
 * the difference between "email is broken" and "DKIM is not verified yet".
 *
 * ── Why it bypasses the preference check ──────────────────────────────────
 * sendEmail() asks wantsEmail() first, which is correct for everything it
 * sends. But an admin who has unsubscribed and is trying to find out why
 * mail is not arriving would get a silent false and conclude the sending
 * was broken — the exact wrong answer. This is a deliberate request from
 * the recipient, made seconds ago, to their own address.
 */
export async function POST() {
  const supabase = await createClient()
  const account = await getAccount(supabase)

  // The same 403 whether they are signed out, not an admin, or suspended.
  if (!hasRole(account, 'admin')) {
    return NextResponse.json({ error: 'Not found.' }, { status: 403 })
  }

  const { data: { user } } = await supabase.auth.getUser()
  const to = user?.email
  if (!to) {
    return NextResponse.json({ error: 'Your account has no email address.' }, { status: 400 })
  }

  const status = emailStatus()
  if (!status.ok) {
    return NextResponse.json({ error: status.reason }, { status: 503 })
  }

  const marketing = marketingBlocked()
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://www.workmark.org'

  const { html, text } = renderEmail({
    body: [
      'This is a test. Somebody pressed the button on the admin overview, and it reached you, which means the key, the sender address and the DNS records are all right.',
      `Sent as: ${status.from}`,
      marketing
        ? `Marketing mail is still blocked: ${marketing}`
        : 'Marketing mail is unblocked — a postal address is set for the footer.',
      'The thing worth checking now is where this landed. If it is in Promotions or Spam, the template is not the problem — look at SPF, DKIM and DMARC on the sending domain.',
    ].join('\n\n'),
    link: { url: `${site}/admin`, label: 'Back to the admin overview' },
    footerLink: { url: `${site}/account/settings#email`, label: 'Manage your email settings' },
    postalAddress: null,
  })

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: status.from,
        to: [to],
        subject: 'Workmark test — email is working',
        html,
        text,
        ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}),
      }),
    })

    const raw = await res.text().catch(() => '')
    if (!res.ok) {
      // Resend's body is where the useful part is — "domain is not verified",
      // "from address is not allowed". Passed through rather than flattened
      // into "something went wrong", because the whole point of this route is
      // to find out which thing went wrong.
      return NextResponse.json(
        { error: `Resend returned ${res.status}. ${raw.slice(0, 500)}` },
        { status: 502 },
      )
    }

    return NextResponse.json({
      ok: true,
      to,
      from: status.from,
      marketingBlocked: marketing,
    })
  } catch (err) {
    return NextResponse.json(
      { error: `Could not reach Resend: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    )
  }
}
