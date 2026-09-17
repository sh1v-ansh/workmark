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
import { parseSender, formatSender } from './from'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

/**
 * Whether mail can go out at all, and if not, which of the two reasons.
 *
 * It used to be two truthiness checks, which meant a malformed EMAIL_FROM
 * passed and then failed at Resend on every send — visible only as a 422 in a
 * server log. "No email is going out" then had four possible causes with one
 * symptom: no key, wrong key, unverified domain, bad from address. This tells
 * the last one apart from the other three before anything is sent.
 */
export function emailStatus(): { ok: true; from: string } | { ok: false; reason: string } {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, reason: 'RESEND_API_KEY is not set.' }
  }
  const sender = parseSender(process.env.EMAIL_FROM)
  if (!sender) {
    return {
      ok: false,
      reason: process.env.EMAIL_FROM
        ? `EMAIL_FROM is not a sender address: ${JSON.stringify(process.env.EMAIL_FROM)}. `
          + 'Use noreply@send.workmark.org or Workmark <noreply@send.workmark.org>.'
        : 'EMAIL_FROM is not set.',
    }
  }
  return { ok: true, from: formatSender(sender) }
}

export function emailAvailable(): boolean {
  return emailStatus().ok
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
    : `${siteUrl()}/account/settings#email`
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
  const status = emailStatus()
  if (!status.ok) {
    // Logged rather than swallowed. Mail being off is a legitimate state in
    // development, but "it is off and here is the one line to change" beats
    // finding out from a user that nobody got an invitation.
    console.error('[notify] not sending —', status.reason)
    return false
  }
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
        // Rebuilt from the parsed parts, so however the variable was written
        // — quoted, spaced oddly, with or without a display name — Resend
        // receives one shape.
        from: status.from,
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

// ── Project workspaces ──
//
// The same test as above: can the recipient act on it today. A card moving is
// not news; being handed work, being asked to unstick somebody, and finding
// out what a finished project put on your record all are.

export function workspaceInvited(args: {
  inviteeId: string; inviteeEmail: string; inviterName: string; projectTitle: string
}) {
  return sendEmail({
    to: args.inviteeEmail,
    userId: args.inviteeId,
    kind: 'workspace_invited',
    subject: `${args.inviterName} invited you to ${args.projectTitle}`,
    body: `${args.inviterName} invited you onto "${args.projectTitle}".\n\nYou will need a connected GitHub account before you can accept — otherwise your commits cannot be told apart from everyone else's, and you would spend the project building evidence for other people.`,
    linkPath: '/workspaces',
    linkLabel: 'See the invitation',
  })
}

export function workspaceTaskAssigned(args: {
  assigneeId: string; assigneeEmail: string; taskTitle: string; projectTitle: string
  workspaceId: string; dueOn: string | null
}) {
  const due = args.dueOn ? `\n\nDue ${args.dueOn}.` : ''
  return sendEmail({
    to: args.assigneeEmail,
    userId: args.assigneeId,
    kind: 'workspace_task_assigned',
    subject: `You picked up "${args.taskTitle}"`,
    body: `"${args.taskTitle}" on ${args.projectTitle} is now yours.${due}\n\nIf the estimate or the deadline turns out to be wrong, change it and say why — a slip you saw coming reads very differently from one nobody mentioned.`,
    linkPath: `/workspaces/${args.workspaceId}`,
    linkLabel: 'Open the board',
  })
}

/**
 * One digest per check, never one per task.
 *
 * A batch that emails five times is a batch people mute, and then the message
 * that actually needed them gets muted with it.
 */
export function workspaceVerdicts(args: {
  studentId: string; studentEmail: string; projectTitle: string; workspaceId: string
  verified: number; needsWork: number; toAPerson: number
}) {
  const parts = [
    args.verified > 0 ? `${args.verified} verified` : null,
    args.needsWork > 0 ? `${args.needsWork} needing more work` : null,
    args.toAPerson > 0 ? `${args.toAPerson} waiting on a teammate` : null,
  ].filter(Boolean)

  return sendEmail({
    to: args.studentEmail,
    userId: args.studentId,
    kind: 'workspace_verdict',
    subject: `Your work on ${args.projectTitle} was checked`,
    body: `${parts.join(', ')}.\n\nEach card shows exactly which checks it rested on — commits, tests, CI, review — so you can see what the answer was based on rather than having to take it.`,
    linkPath: `/workspaces/${args.workspaceId}`,
    linkLabel: 'See the results',
  })
}

export function workspaceReviewNeeded(args: {
  reviewerId: string; reviewerEmail: string; projectTitle: string; workspaceId: string
  count: number; authorName: string
}) {
  const tasks = args.count === 1 ? 'a task' : `${args.count} tasks`
  return sendEmail({
    to: args.reviewerEmail,
    userId: args.reviewerId,
    kind: 'workspace_review_needed',
    subject: `${args.authorName} ${args.authorName === 'Your teammates' ? 'need' : 'needs'} you to confirm ${args.count === 1 ? 'a task' : 'some work'}`,
    body: `Workmark could not check ${tasks} on ${args.projectTitle} by itself — either there was no code to look at, or it has already come back needing changes twice.\n\nIt cannot move until somebody who did not do the work says whether it does what it was supposed to. That takes about a minute.`,
    linkPath: `/workspaces/${args.workspaceId}`,
    linkLabel: 'Take a look',
  })
}

/**
 * The same question as workspaceReviewNeeded, asked once more days later.
 *
 * Worded as a reminder rather than repeated verbatim. A message identical to
 * one somebody already read is one they assume they have already dealt with,
 * and the whole reason this is being sent is that they have not.
 */
export function workspaceReviewStale(args: {
  reviewerId: string; reviewerEmail: string; projectTitle: string; workspaceId: string
  count: number; oldestDays: number
}) {
  const tasks = args.count === 1 ? 'a task' : `${args.count} tasks`
  return sendEmail({
    to: args.reviewerEmail,
    userId: args.reviewerId,
    kind: 'workspace_review_needed',
    subject: `Still waiting on you: ${tasks} on ${args.projectTitle}`,
    body: `${args.count === 1 ? 'A task' : `${args.count} tasks`} on ${args.projectTitle} ${args.count === 1 ? 'has' : 'have'} been waiting ${args.oldestDays} days for somebody to confirm ${args.count === 1 ? 'it' : 'them'}.\n\nWhoever did the work cannot answer this themselves, so it stays put until you look. It takes about a minute, and until then it counts for nothing on their record.`,
    linkPath: `/workspaces/${args.workspaceId}`,
    linkLabel: 'Confirm the work',
  })
}

/**
 * A board with nothing much left on it.
 *
 * Deliberately does not propose the work. Sending somebody tasks a model
 * invented overnight, unasked, makes the plan Workmark's rather than theirs —
 * and the plan being the student's is the thing that makes the record mean
 * anything. This points at the button; they decide whether to press it.
 */
export function workspaceBoardDry(args: {
  ownerId: string; ownerEmail: string; projectTitle: string; workspaceId: string
  openTasks: number
}) {
  return sendEmail({
    to: args.ownerEmail,
    userId: args.ownerId,
    kind: 'workspace_board_dry',
    subject: `${args.projectTitle} is nearly out of work`,
    body: args.openTasks === 0
      ? `Every task on ${args.projectTitle} is done. If the project is finished, close it out and your verified work goes onto your record. If it is not, plan the next piece.`
      : `${args.projectTitle} has ${args.openTasks === 1 ? 'one task' : `${args.openTasks} tasks`} left on it.\n\nWorth deciding what comes next before you run out — a project that quietly stops a fortnight before it was finished puts less on your record than one you closed out on purpose.`,
    linkPath: `/workspaces/${args.workspaceId}`,
    linkLabel: 'Open the board',
  })
}

export function workspaceClosed(args: {
  studentId: string; studentEmail: string; projectTitle: string; skillCount: number
  finishedTasks: number; pending: boolean
}) {
  const skills = args.skillCount === 1 ? '1 verified skill' : `${args.skillCount} verified skills`
  return sendEmail({
    to: args.studentEmail,
    userId: args.studentId,
    kind: 'workspace_closed',
    subject: `"${args.projectTitle}" is finished`,
    body: args.pending
      ? `"${args.projectTitle}" was closed. Reading the repository takes a few minutes, so your record will finish updating shortly — nothing is lost.`
      : args.skillCount > 0
        ? `"${args.projectTitle}" was closed, adding ${skills} to your record from ${args.finishedTasks} verified ${args.finishedTasks === 1 ? 'task' : 'tasks'}.\n\nThis is the strongest kind of evidence Workmark records, because the acceptance criteria were written down before the work started rather than described afterwards.`
        : `"${args.projectTitle}" was closed.\n\nNo skills were added — usually that means the repository had no commits under your GitHub account, or none of your tasks were verified.`,
    linkPath: '/me',
    linkLabel: 'See your record',
  })
}
