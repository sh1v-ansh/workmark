// Transactional email.
//
// Workmark is asynchronous by nature — someone applies, and the poster
// finds out whenever they next open the site. Without email the product
// silently depends on people habitually checking a page they have no
// reason to check, which is how a marketplace dies quietly rather than
// loudly.
//
// Plain fetch against Resend rather than an SDK: three calls, one
// endpoint, no auth flow. A dependency here would be more code to keep
// current than the request it replaces.
//
// Every send is best-effort and never blocks or fails the action that
// triggered it. An accepted application that 500s because the
// notification bounced is strictly worse than an acceptance nobody was
// emailed about.

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { wantsEmail, EMAIL_KINDS, type EmailKind } from './prefs'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export function emailAvailable(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://www.workmark.org'
}

interface SendArgs {
  to: string
  /**
   * The recipient's account id.
   *
   * Required, not optional. Every send now goes through a preference check,
   * and an optional id would make "forgot to pass it" indistinguishable
   * from "no preference to check" — which is how an unsubscribe quietly
   * stops working for one notification kind and nobody notices.
   */
  userId: string
  kind: EmailKind
  subject: string
  /** Plain text. Kept deliberately plain — see the note in `render`. */
  body: string
  /** Appended as a single call-to-action link. */
  linkPath?: string
  linkLabel?: string
}

/**
 * Minimal HTML. No template engine, no images, no tracking pixels: these
 * are notifications a student needs to act on, and a plain message that
 * renders identically everywhere beats a designed one that trips spam
 * filters on a domain with no sending reputation yet.
 */
function render(
  { body, linkPath, linkLabel, kind }: SendArgs,
  unsubscribeToken: string | null,
): { html: string; text: string } {
  const url = linkPath ? `${siteUrl()}${linkPath}` : null

  // One click, no login, no confirmation page that asks again. An
  // unsubscribe link that makes someone sign in first is the reason people
  // press the spam button instead — and a young sending domain does not
  // survive much of that.
  //
  // Essential mail (the answer to an application they sent) still carries
  // the link, pointed at the settings page rather than a one-click off,
  // because there is nothing here to switch off and pretending otherwise
  // would be a lie.
  const essential = EMAIL_KINDS[kind].essential
  const unsub = unsubscribeToken && !essential
    ? `${siteUrl()}/api/unsubscribe?token=${unsubscribeToken}&kind=${kind}`
    : `${siteUrl()}/account/notifications`
  const unsubLabel = essential ? 'Manage your email settings' : 'Unsubscribe from these'

  const text = url
    ? `${body}\n\n${linkLabel ?? 'Open Workmark'}: ${url}\n\n—\n${unsubLabel}: ${unsub}\n`
    : `${body}\n\n—\n${unsubLabel}: ${unsub}\n`
  const paragraphs = body
    .split('\n\n')
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6">${escapeHtml(p)}</p>`)
    .join('')
  const cta = url
    ? `<p style="margin:24px 0 0"><a href="${url}" style="color:#3E1FFF">${escapeHtml(linkLabel ?? 'Open Workmark')}</a></p>`
    : ''
  return {
    text,
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;color:#1a1a1a;max-width:520px">${paragraphs}${cta}<p style="margin:32px 0 0;font-size:12px;color:#888">Workmark · <a href="${unsub}" style="color:#888">${unsubLabel}</a></p></div>`,
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function sendEmail(args: SendArgs): Promise<boolean> {
  if (!emailAvailable()) return false
  if (!args.to) return false

  // Asked before the send, not filtered after. Costs one indexed lookup on
  // a path that is already making a network call to Resend.
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  if (!(await wantsEmail(admin, args.userId, args.kind))) return false

  const { data: account } = await admin
    .from('accounts')
    .select('unsubscribe_token')
    .eq('id', args.userId)
    .maybeSingle()

  const token = account?.unsubscribe_token ?? null
  const { html, text } = render(args, token)

  // The headers Gmail and Apple Mail read to draw their own Unsubscribe
  // button next to the sender name. Worth more than the link in the footer:
  // it's the button someone reaches for instead of "report spam", and
  // bulk senders without it get filtered harder.
  const unsubHeaders = token && !EMAIL_KINDS[args.kind].essential
    ? {
        'List-Unsubscribe': `<${siteUrl()}/api/unsubscribe?token=${token}&kind=${args.kind}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      }
    : undefined

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [args.to],
        subject: args.subject,
        html,
        text,
        // Automated mail goes out on a sending subdomain, which keeps its
        // reputation separate from the domain's real mail — but that address
        // has no inbox behind it. Without a reply-to, anyone who hits reply
        // is writing to nobody, and they won't know. EMAIL_REPLY_TO points
        // at a mailbox a person actually reads.
        ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}),
        ...(unsubHeaders ? { headers: unsubHeaders } : {}),
      }),
    })
    if (!res.ok) {
      console.error('[notify] send failed:', res.status, await res.text().catch(() => ''))
      return false
    }
    return true
  } catch (err) {
    console.error('[notify] send threw:', err)
    return false
  }
}

// ── The four moments worth interrupting someone for ──
// Deliberately not: every message, every status change, every scan.
// A notification the recipient can't act on trains them to ignore the
// ones they can.

export function applicationReceived(args: { posterId: string; posterEmail: string; applicantName: string; listingTitle: string; listingId: string }) {
  return sendEmail({
    to: args.posterEmail,
    userId: args.posterId,
    kind: 'application_received',
    subject: `${args.applicantName} applied to ${args.listingTitle}`,
    body: `${args.applicantName} applied to your project "${args.listingTitle}".\n\nYou can see which of your required skills their linked repositories actually demonstrate, and message them before deciding.`,
    linkPath: `/listings/${args.listingId}/applicants`,
    linkLabel: 'Review the application',
  })
}

export function applicationAccepted(args: { studentId: string; studentEmail: string; posterName: string; listingTitle: string; engagementId: string }) {
  return sendEmail({
    to: args.studentEmail,
    userId: args.studentId,
    kind: 'application_accepted',
    subject: `You're in — ${args.listingTitle}`,
    body: `${args.posterName} accepted your application to "${args.listingTitle}".\n\nYou both have each other's contact details now. The engagement page is where you agree on what the work is and close it out when it's done.`,
    linkPath: `/engagements/${args.engagementId}`,
    linkLabel: 'Open the engagement',
  })
}

export function workSubmitted(args: { posterId: string; posterEmail: string; studentName: string; listingTitle: string; engagementId: string }) {
  return sendEmail({
    to: args.posterEmail,
    userId: args.posterId,
    kind: 'work_submitted',
    subject: `${args.studentName} submitted work on ${args.listingTitle}`,
    body: `${args.studentName} marked their work on "${args.listingTitle}" as submitted.\n\nOnce you've both agreed on a description of what was built, you can close it out — that's what adds the verified skills to their record.`,
    linkPath: `/engagements/${args.engagementId}`,
    linkLabel: 'Review and close out',
  })
}

export function engagementClosed(args: { studentId: string; studentEmail: string; listingTitle: string; skillCount: number }) {
  const skills = args.skillCount === 1 ? '1 verified skill' : `${args.skillCount} verified skills`
  return sendEmail({
    to: args.studentEmail,
    userId: args.studentId,
    kind: 'engagement_closed',
    subject: `"${args.listingTitle}" was closed out`,
    body: args.skillCount > 0
      ? `Your work on "${args.listingTitle}" was closed out, adding ${skills} to your record.\n\nThis is collaboration evidence — it carries more weight than a solo project, and it's on your public profile if you've claimed a handle.`
      : `Your work on "${args.listingTitle}" was closed out.\n\nNo repository was linked, so this counts toward your track record but didn't add skill evidence.`,
    linkPath: '/me',
    linkLabel: 'See your record',
  })
}

/**
 * The one nobody wants to send, and the one most worth sending.
 *
 * A rejection that never arrives leaves someone refreshing a page for weeks
 * and holding one of their five application slots against a decision that
 * was already made. No invented reason and no false comfort — the useful
 * fact is that the slot is free again.
 */
export function applicationRejected(args: { studentId: string; studentEmail: string; listingTitle: string }) {
  return sendEmail({
    to: args.studentEmail,
    userId: args.studentId,
    kind: 'application_rejected',
    subject: `Update on your application to ${args.listingTitle}`,
    body: `Your application to "${args.listingTitle}" wasn't taken forward.\n\nThat frees up one of your active applications, so you can apply elsewhere whenever you're ready.`,
    linkPath: '/listings',
    linkLabel: 'Find other projects',
  })
}
