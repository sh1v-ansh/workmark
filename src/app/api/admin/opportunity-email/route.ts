import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getAccount, hasRole } from '@/lib/auth/roles'
import { sendOpportunityEmail, optedInRecipients, marketingBlocked } from '@/lib/notify/opportunities'

export const maxDuration = 300

/**
 * POST /api/admin/opportunity-email  { mode: 'test' | 'all', subject, body, linkUrl?, linkLabel? }
 *
 * Admins only. 'test' sends to the admin themselves through exactly the same
 * gates as a real send, so it also proves the opt-in check works: an admin
 * who has not opted in is told to, rather than silently mailed. 'all' sends
 * one message to each opted-in student, one after another, spaced out to
 * stay under Resend's rate limit.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const account = await getAccount(supabase)
  if (!hasRole(account, 'admin')) return NextResponse.json({ error: 'Not found.' }, { status: 403 })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Your account has no email address.' }, { status: 400 })

  const blocked = marketingBlocked()
  if (blocked) return NextResponse.json({ error: blocked }, { status: 503 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const subject = typeof body.subject === 'string' ? body.subject.trim().slice(0, 150) : ''
  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 5000) : ''
  const linkUrl = typeof body.linkUrl === 'string' && body.linkUrl.trim() ? body.linkUrl.trim().slice(0, 500) : null
  const linkLabel = typeof body.linkLabel === 'string' && body.linkLabel.trim() ? body.linkLabel.trim().slice(0, 60) : null
  if (!subject || !text) return NextResponse.json({ error: 'A subject and a message are both needed.' }, { status: 400 })
  if (linkUrl && !linkUrl.startsWith('/') && !/^https:\/\//.test(linkUrl)) {
    return NextResponse.json({ error: 'Links must start with / or https://' }, { status: 400 })
  }

  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const email = { subject, body: text, linkUrl, linkLabel }

  if (body.mode === 'test') {
    const result = await sendOpportunityEmail(admin, { id: user.id, email: user.email }, { ...email, subject: `[Test] ${subject}` })
    if (result === 'not_opted_in') {
      return NextResponse.json({ error: 'You have not opted in to opportunity emails. Turn them on in Settings → Email, then try again. (This is the same check every student goes through.)' }, { status: 409 })
    }
    if (result === 'failed') return NextResponse.json({ error: 'Resend refused the email. Check Resend → Logs.' }, { status: 502 })
    return NextResponse.json({ ok: true, sent: 1 })
  }

  if (body.mode !== 'all') return NextResponse.json({ error: 'Unknown mode.' }, { status: 400 })

  const recipients = await optedInRecipients(admin)
  let sent = 0
  let failed = 0
  for (const r of recipients) {
    const result = await sendOpportunityEmail(admin, r, email)
    if (result === 'sent') sent++
    else if (result === 'failed') failed++
    // Resend's default limit is a few requests a second.
    await new Promise((resolve) => setTimeout(resolve, 600))
  }
  return NextResponse.json({ ok: true, sent, failed, total: recipients.length })
}
