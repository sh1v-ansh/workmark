import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { EMAIL_KINDS, type EmailKind } from '@/lib/notify/prefs'

/**
 * GET /api/unsubscribe?token=…&kind=…
 *
 * One click, from inside the email client, with no session and no
 * confirmation step. That is the whole design: an unsubscribe link that
 * makes someone sign in first is why people press "report spam" instead,
 * and on a young sending domain a handful of spam complaints is the
 * difference between mail arriving and mail disappearing.
 *
 * A GET that changes state is normally wrong. Here it's the requirement —
 * RFC 8058 and every mail client's unsubscribe button do exactly this — and
 * the risk it usually carries doesn't apply: the token is per-account, the
 * only thing it can do is turn something off, and turning it back on takes
 * one click on the page this redirects to.
 *
 * `kind` switches off one notification type. Without it, everything
 * non-essential goes off at once, which is what a mail client's own
 * unsubscribe button will send.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  const kind = url.searchParams.get('kind')

  if (!token) return NextResponse.redirect(new URL('/account/notifications', request.url))

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: account } = await admin
    .from('accounts')
    .select('id, notification_prefs')
    .eq('unsubscribe_token', token)
    .maybeSingle()

  // A bad or rotated token gets the settings page rather than an error.
  // Someone clicking unsubscribe wants the mail to stop; telling them their
  // link is invalid and leaving it at that is a dead end.
  if (!account) {
    return NextResponse.redirect(new URL('/account/notifications?stale=1', request.url))
  }

  const now = new Date().toISOString()

  if (kind && kind in EMAIL_KINDS && !EMAIL_KINDS[kind as EmailKind].essential) {
    const prefs = { ...((account.notification_prefs ?? {}) as Record<string, boolean>), [kind]: false }
    await admin.from('accounts').update({ notification_prefs: prefs, updated_at: now }).eq('id', account.id)
    return NextResponse.redirect(new URL(`/account/notifications?off=${kind}`, request.url))
  }

  await admin
    .from('accounts')
    .update({ email_unsubscribed_at: now, updated_at: now })
    .eq('id', account.id)

  return NextResponse.redirect(new URL('/account/notifications?off=all', request.url))
}

/**
 * POST /api/unsubscribe
 *
 * The List-Unsubscribe-Post target. Mail clients that support one-click
 * send a POST here rather than following the link, and treat a link-only
 * unsubscribe as a weaker signal.
 */
export async function POST(request: Request) {
  return GET(request)
}
