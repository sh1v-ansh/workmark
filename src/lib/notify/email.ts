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

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export function emailAvailable(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://www.workmark.org'
}

interface SendArgs {
  to: string
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
function render({ body, linkPath, linkLabel }: SendArgs): { html: string; text: string } {
  const url = linkPath ? `${siteUrl()}${linkPath}` : null
  const text = url ? `${body}\n\n${linkLabel ?? 'Open Workmark'}: ${url}\n` : `${body}\n`
  const paragraphs = body
    .split('\n\n')
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6">${escapeHtml(p)}</p>`)
    .join('')
  const cta = url
    ? `<p style="margin:24px 0 0"><a href="${url}" style="color:#3E1FFF">${escapeHtml(linkLabel ?? 'Open Workmark')}</a></p>`
    : ''
  return {
    text,
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;color:#1a1a1a;max-width:520px">${paragraphs}${cta}<p style="margin:32px 0 0;font-size:12px;color:#888">Workmark</p></div>`,
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function sendEmail(args: SendArgs): Promise<boolean> {
  if (!emailAvailable()) return false
  if (!args.to) return false

  const { html, text } = render(args)

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

export function applicationReceived(args: { posterEmail: string; applicantName: string; listingTitle: string; listingId: string }) {
  return sendEmail({
    to: args.posterEmail,
    subject: `${args.applicantName} applied to ${args.listingTitle}`,
    body: `${args.applicantName} applied to your project "${args.listingTitle}".\n\nYou can see which of your required skills their linked repositories actually demonstrate, and message them before deciding.`,
    linkPath: `/listings/${args.listingId}/applicants`,
    linkLabel: 'Review the application',
  })
}

export function applicationAccepted(args: { studentEmail: string; posterName: string; listingTitle: string; engagementId: string }) {
  return sendEmail({
    to: args.studentEmail,
    subject: `You're in — ${args.listingTitle}`,
    body: `${args.posterName} accepted your application to "${args.listingTitle}".\n\nYou both have each other's contact details now. The engagement page is where you agree on what the work is and close it out when it's done.`,
    linkPath: `/engagements/${args.engagementId}`,
    linkLabel: 'Open the engagement',
  })
}

export function workSubmitted(args: { posterEmail: string; studentName: string; listingTitle: string; engagementId: string }) {
  return sendEmail({
    to: args.posterEmail,
    subject: `${args.studentName} submitted work on ${args.listingTitle}`,
    body: `${args.studentName} marked their work on "${args.listingTitle}" as submitted.\n\nOnce you've both agreed on a description of what was built, you can close it out — that's what adds the verified skills to their record.`,
    linkPath: `/engagements/${args.engagementId}`,
    linkLabel: 'Review and close out',
  })
}

export function engagementClosed(args: { studentEmail: string; listingTitle: string; skillCount: number }) {
  const skills = args.skillCount === 1 ? '1 verified skill' : `${args.skillCount} verified skills`
  return sendEmail({
    to: args.studentEmail,
    subject: `"${args.listingTitle}" was closed out`,
    body: args.skillCount > 0
      ? `Your work on "${args.listingTitle}" was closed out, adding ${skills} to your record.\n\nThis is collaboration evidence — it carries more weight than a solo project, and it's on your public profile if you've claimed a handle.`
      : `Your work on "${args.listingTitle}" was closed out.\n\nNo repository was linked, so this counts toward your track record but didn't add skill evidence.`,
    linkPath: '/me',
    linkLabel: 'See your record',
  })
}
