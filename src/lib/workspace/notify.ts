// Telling people about a project they are not currently looking at.
//
// Everything else in the workspace feature assumes somebody has the board
// open. These are the moments where that assumption fails and the product
// quietly stops working: an invitation nobody sees is a row in a table, and a
// task waiting on a teammate who never visits is a card that never moves.
//
// Two rules hold throughout, and they are the same ones email.ts already
// encodes:
//
//   Never block. A verdict that 500s because a notification bounced is
//   strictly worse than a verdict nobody was emailed about. Every function
//   here swallows its own failures and logs them.
//
//   One message per event, not per row. A batch check that emails five times
//   is a batch people mute — and then the message that actually needed them
//   gets muted along with it.

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  emailAvailable, workspaceInvited, workspaceTaskAssigned,
  workspaceVerdicts, workspaceReviewNeeded, workspaceClosed,
  workspaceReviewStale, workspaceBoardDry,
} from '@/lib/notify/email'
import { chaseable, nudgeable, digest } from './attention'

interface Recipient {
  accountId: string
  email: string
  name: string
}

/**
 * Email addresses live in auth, display names in accounts.
 *
 * Both are looked up under the service role because neither is readable by
 * the person being notified about — a teammate's address is not theirs to
 * see, and this code is the only thing that needs it.
 */
async function recipients(
  admin: SupabaseClient,
  accountIds: string[],
): Promise<Map<string, Recipient>> {
  const unique = Array.from(new Set(accountIds.filter(Boolean)))
  if (unique.length === 0) return new Map()

  const { data: accounts } = await admin
    .from('accounts')
    .select('id, display_name')
    .in('id', unique)

  const names = new Map((accounts ?? []).map((a) => [a.id as string, a.display_name as string | null]))
  const out = new Map<string, Recipient>()

  // One call each: there is no bulk lookup by id, and these lists are at most
  // four people because that is the team cap.
  for (const id of unique) {
    try {
      const { data } = await admin.auth.admin.getUserById(id)
      const email = data?.user?.email
      if (!email) continue
      out.set(id, { accountId: id, email, name: names.get(id) ?? 'A teammate' })
    } catch (err) {
      console.error(`[workspace/notify] could not resolve ${id}:`, err)
    }
  }
  return out
}

/** Everyone on the team right now, minus whoever is excluded. */
async function activeMemberIds(
  admin: SupabaseClient,
  workspaceId: string,
  except: (string | null)[] = [],
): Promise<string[]> {
  const skip = new Set(except.filter(Boolean) as string[])
  const { data } = await admin
    .from('workspace_members')
    .select('account_id')
    .eq('workspace_id', workspaceId)
    .not('accepted_at', 'is', null)
    .is('removed_at', null)

  return (data ?? [])
    .map((m) => m.account_id as string)
    .filter((id) => !skip.has(id))
}

/**
 * Somebody was invited onto a project.
 *
 * The one notification here that is marked essential, because the whole
 * purpose of an invitation is reaching a person who is not on the site.
 */
export async function notifyInvited(
  admin: SupabaseClient,
  args: { workspaceId: string; inviteeId: string; inviterId: string; projectTitle: string },
): Promise<void> {
  if (!emailAvailable()) return
  try {
    const people = await recipients(admin, [args.inviteeId, args.inviterId])
    const invitee = people.get(args.inviteeId)
    if (!invitee) return
    await workspaceInvited({
      inviteeId: invitee.accountId,
      inviteeEmail: invitee.email,
      inviterName: people.get(args.inviterId)?.name ?? 'A teammate',
      projectTitle: args.projectTitle,
    })
  } catch (err) {
    console.error('[workspace/notify] invitation email failed:', err)
  }
}

/**
 * A task landed on somebody.
 *
 * Only when it landed on somebody *else*. Assigning work to yourself is not
 * news, and an email confirming what you just did is the kind of noise that
 * teaches people to filter the sender.
 */
export async function notifyAssigned(
  admin: SupabaseClient,
  args: {
    workspaceId: string; assigneeId: string; actorId: string
    taskTitle: string; dueOn: string | null
  },
): Promise<void> {
  if (!emailAvailable()) return
  if (args.assigneeId === args.actorId) return
  try {
    const [{ data: workspace }, people] = await Promise.all([
      admin.from('workspaces').select('title').eq('id', args.workspaceId).maybeSingle(),
      recipients(admin, [args.assigneeId]),
    ])
    const assignee = people.get(args.assigneeId)
    if (!assignee) return
    await workspaceTaskAssigned({
      assigneeId: assignee.accountId,
      assigneeEmail: assignee.email,
      taskTitle: args.taskTitle,
      projectTitle: (workspace?.title as string) ?? 'your project',
      workspaceId: args.workspaceId,
      dueOn: args.dueOn,
    })
  } catch (err) {
    console.error('[workspace/notify] assignment email failed:', err)
  }
}

export interface VerdictDigestRow {
  assigneeId: string | null
  verdict: 'verified' | 'needs_work' | 'unverifiable'
}

/**
 * What a batch check decided, one message per person.
 *
 * Grouped by whose work it was, not by task. Somebody who submitted six
 * things gets one email saying four passed and two need work — which is the
 * sentence they wanted — rather than six emails they have to reconcile.
 *
 * A run that decided nothing for a person sends them nothing.
 */
export async function notifyVerdicts(
  admin: SupabaseClient,
  workspaceId: string,
  rows: VerdictDigestRow[],
): Promise<void> {
  if (!emailAvailable()) return
  try {
    const byPerson = new Map<string, { verified: number; needsWork: number; toAPerson: number }>()
    for (const row of rows) {
      if (!row.assigneeId) continue
      const tally = byPerson.get(row.assigneeId) ?? { verified: 0, needsWork: 0, toAPerson: 0 }
      if (row.verdict === 'verified') tally.verified++
      else if (row.verdict === 'needs_work') tally.needsWork++
      else tally.toAPerson++
      byPerson.set(row.assigneeId, tally)
    }
    if (byPerson.size === 0) return

    const [{ data: workspace }, people] = await Promise.all([
      admin.from('workspaces').select('title').eq('id', workspaceId).maybeSingle(),
      recipients(admin, Array.from(byPerson.keys())),
    ])
    const projectTitle = (workspace?.title as string) ?? 'your project'

    for (const [accountId, tally] of Array.from(byPerson.entries())) {
      const person = people.get(accountId)
      if (!person) continue
      await workspaceVerdicts({
        studentId: person.accountId,
        studentEmail: person.email,
        projectTitle,
        workspaceId,
        ...tally,
      })
    }

    // The people who can unstick the ones that need a person. Sent to the
    // rest of the team rather than to the author, who cannot answer their
    // own work and would only be told they are waiting.
    const stuck = rows.filter((r) => r.verdict === 'unverifiable')
    if (stuck.length === 0) return

    const authorIds = Array.from(new Set(stuck.map((r) => r.assigneeId).filter(Boolean))) as string[]

    // Named only when there is one name to give. "Alice needs you to confirm
    // 3 tasks" when two of them are Bob's is a small lie that costs the
    // reader a minute of confusion when they open the board.
    const authorName = authorIds.length === 1
      ? (people.get(authorIds[0])?.name ?? 'A teammate')
      : 'Your teammates'

    // Nobody is asked about their own work. On a solo project that empties
    // the list, which is correct — the admin queue is the backstop there.
    const reviewerIds = await activeMemberIds(admin, workspaceId, authorIds)
    if (reviewerIds.length === 0) return

    const reviewers = await recipients(admin, reviewerIds)
    for (const reviewer of Array.from(reviewers.values())) {
      await workspaceReviewNeeded({
        reviewerId: reviewer.accountId,
        reviewerEmail: reviewer.email,
        projectTitle,
        workspaceId,
        count: stuck.length,
        authorName,
      })
    }
  } catch (err) {
    console.error('[workspace/notify] verdict emails failed:', err)
  }
}

/**
 * A project ended, and here is what it put on your record.
 *
 * Sent to everyone who was on it, including people whose record gained
 * nothing — being told a project closed and added nothing is more useful than
 * silence, and it is the prompt to go and find out why.
 */
export async function notifyClosed(
  admin: SupabaseClient,
  args: {
    workspaceId: string; projectTitle: string; finishedTasks: number
    pending: boolean
    /** Skills written per account, from the minting pass. */
    skillsByMember: Map<string, number>
  },
): Promise<void> {
  if (!emailAvailable()) return
  try {
    const memberIds = await activeMemberIds(admin, args.workspaceId)
    const people = await recipients(admin, memberIds)
    for (const person of Array.from(people.values())) {
      await workspaceClosed({
        studentId: person.accountId,
        studentEmail: person.email,
        projectTitle: args.projectTitle,
        skillCount: args.skillsByMember.get(person.accountId) ?? 0,
        finishedTasks: args.finishedTasks,
        pending: args.pending,
      })
    }
  } catch (err) {
    console.error('[workspace/notify] close emails failed:', err)
  }
}

/**
 * The nightly pass over what has gone quiet.
 *
 * Two checks, both of which exist because the product's failure mode is
 * silence rather than error: a card waiting on a person is mentioned once
 * when the verdict lands and then never again, and a board that has run out
 * of work says nothing at all.
 *
 * No model call. Deciding that a board is nearly empty is a count, and
 * deciding a review is overdue is a subtraction — running the planner nightly
 * for every project would be a bill per student per night, and would hand
 * them a plan they did not write. `attention.ts` holds the arithmetic so the
 * thresholds can be argued with in a test.
 *
 * Marked as done before the mail is sent, and deliberately. Marking after
 * would mean a crash mid-batch re-sends everything the next night, and the
 * failure this is guarding against is being noisy — a reminder that is
 * silently dropped once is a much smaller problem than one that arrives
 * every night for a fortnight.
 */
export async function sweepAttention(admin: SupabaseClient): Promise<{
  chased: number
  nudged: number
}> {
  const now = new Date()
  let chased = 0
  let nudged = 0

  // ── Reviews nobody has answered ──
  try {
    const { data: stuck } = await admin
      .from('task_submissions')
      .select('id, workspace_id, task_id, submitted_at, review_chased_at, submitted_by, tasks(assignee_id), workspaces(title, status)')
      .eq('verdict', 'unverifiable')
      .is('human_verdict', null)
      .is('review_chased_at', null)
      .order('submitted_at')
      .limit(200)

    const live = (stuck ?? []).filter((r) => {
      const ws = r.workspaces as unknown as { status: string | null } | null
      return ws?.status === 'active'
    })

    const due = chaseable(
      live.map((r) => ({
        submissionId: r.id as string,
        workspaceId: r.workspace_id as string,
        taskId: r.task_id as string,
        submittedAt: r.submitted_at as string,
        reviewChasedAt: r.review_chased_at as string | null,
      })),
      now,
    )
    const dueIds = new Set(due.map((d) => d.submissionId))
    const rows = live.filter((r) => dueIds.has(r.id as string))

    // One email per person per project, not one per card.
    type StuckRow = (typeof rows)[number]
    const byProject = Array.from(digest<StuckRow>(rows, (r) => r.workspace_id as string))

    for (const [workspaceId, group] of byProject) {
      const title = ((group[0].workspaces as unknown as { title: string | null } | null)?.title) ?? 'a project'

      // Barred for the same reason canReview bars them: whoever did the work
      // cannot confirm it. Both the assignee and whoever pressed submit, since
      // a card can be submitted with nobody assigned to it.
      const barred = group.flatMap((r: StuckRow) => [
        (r.tasks as unknown as { assignee_id: string | null } | null)?.assignee_id ?? null,
        r.submitted_by as string | null,
      ])

      const reviewerIds = await activeMemberIds(admin, workspaceId, barred)
      const oldest = Math.max(
        ...group.map((r: StuckRow) => Math.floor(
          (now.getTime() - new Date(r.submitted_at as string).getTime()) / 86_400_000,
        )),
      )

      await admin
        .from('task_submissions')
        .update({ review_chased_at: now.toISOString() })
        .in('id', group.map((r: StuckRow) => r.id as string))

      // Nobody left to ask. Correct on a solo project, and the reason the
      // admin queue exists — marked above regardless, so staff are the only
      // ones chased about it from here.
      if (reviewerIds.length === 0) continue

      const reviewers = await recipients(admin, reviewerIds)
      for (const reviewer of Array.from(reviewers.values())) {
        await workspaceReviewStale({
          reviewerId: reviewer.accountId,
          reviewerEmail: reviewer.email,
          projectTitle: title,
          workspaceId,
          count: group.length,
          oldestDays: oldest,
        })
        chased += 1
      }
    }
  } catch (err) {
    console.error('[workspace/notify] chasing stale reviews failed:', err)
  }

  // ── Boards that have run dry ──
  try {
    const { data: projects } = await admin
      .from('workspaces')
      .select('id, title, deadline, replan_nudged_at, created_by, tasks(status)')
      .eq('status', 'active')
      .limit(500)

    const boards = (projects ?? []).map((w) => {
      const tasks = (w.tasks as unknown as { status: string }[] | null) ?? []
      return {
        workspaceId: w.id as string,
        openTasks: tasks.filter((t) => t.status !== 'verified' && t.status !== 'accepted').length,
        replanNudgedAt: w.replan_nudged_at as string | null,
        deadline: w.deadline as string | null,
      }
    })

    const due = new Set(nudgeable(boards, now).map((b) => b.workspaceId))
    const byId = new Map(boards.map((b) => [b.workspaceId, b]))

    for (const project of (projects ?? []).filter((w) => due.has(w.id as string))) {
      const workspaceId = project.id as string

      await admin
        .from('workspaces')
        .update({ replan_nudged_at: now.toISOString() })
        .eq('id', workspaceId)

      // The owner, because planning the next piece is theirs to do. Telling
      // the whole team a board is empty is three people waiting for each other.
      const ownerId = project.created_by as string | null
      if (!ownerId) continue
      const owner = (await recipients(admin, [ownerId])).get(ownerId)
      if (!owner) continue

      await workspaceBoardDry({
        ownerId: owner.accountId,
        ownerEmail: owner.email,
        projectTitle: (project.title as string | null) ?? 'Your project',
        workspaceId,
        openTasks: byId.get(workspaceId)?.openTasks ?? 0,
      })
      nudged += 1
    }
  } catch (err) {
    console.error('[workspace/notify] nudging dry boards failed:', err)
  }

  return { chased, nudged }
}
