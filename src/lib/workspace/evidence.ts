// Verified project work reaching the student's record.
//
// This is the point of the whole feature. Everything before it — the board,
// the estimates, the event ledger, the verifier — produces a project full of
// Verified cards, and until this ran, none of it appeared on /me. A student
// could do eight weeks of real work and their record would be unchanged.
//
// It deliberately does NOT introduce a second evidence pipeline. Workmark
// already has one — artifacts + skill_priors + skill_evidence +
// evidence_audit, written by src/lib/skills/evidence.ts and minted at
// engagement close-out — and a parallel path would mean two definitions of
// what a skill level means, two dedup rules, and two places for a dispute to
// have to argue with. All this module does is decide WHO is owed evidence
// from a project and hand each of them to processRepo.
//
// Service role throughout: skill_evidence and artifacts have no user insert
// policy, by design.

import type { SupabaseClient } from '@supabase/supabase-js'
import { processRepo, type ProcessRepoResult } from '@/lib/skills/evidence'

/** Task states that count as work actually finished. */
export const FINISHED_STATUSES = ['verified', 'accepted'] as const

export interface MemberEvidenceInput {
  accountId: string
  /** Null when this account is not a student — faculty have no students row. */
  githubUsername: string | null
  /** Null when they never agreed to their work being read. */
  scanConsentAt: string | null
  /** Tasks assigned to them that reached Verified or Accepted. */
  verifiedTaskCount: number
}

export type SkipReason =
  | 'no_verified_work'
  | 'no_consent'
  | 'no_github_username'

export const SKIP_EXPLANATION: Record<SkipReason, string> = {
  no_verified_work: 'No task of theirs was verified, so the project has nothing to attest to.',
  no_consent: 'They have not agreed to Workmark reading their work on this project.',
  no_github_username: 'No GitHub account is connected, so their commits cannot be attributed.',
}

/**
 * Should this person get evidence from this project?
 *
 * Pure, and separate from the writing, because these three rules are the ones
 * worth being able to test and argue about. Each refuses for a different
 * reason and none of them is a bug:
 *
 * - **No verified work.** The tier this mints is earned by criteria written
 *   before the code existed and checked afterwards. Somebody who was on the
 *   team but finished nothing has no such check to point at. Their board
 *   activity still exists in workspace_metrics; it is simply not a claim
 *   about a skill.
 * - **No consent.** The same gate ingest.ts already applies when attributing
 *   commits. Somebody who never agreed to their work being read does not
 *   start having it read because a project closed.
 * - **No GitHub account.** Nothing can be attributed to a login that does not
 *   exist, and evidence attributed to the wrong person is worse than none.
 */
export function evidenceSkipReason(member: MemberEvidenceInput): SkipReason | null {
  if (member.verifiedTaskCount === 0) return 'no_verified_work'
  if (member.scanConsentAt === null) return 'no_consent'
  if (!member.githubUsername) return 'no_github_username'
  return null
}

export interface MemberEvidenceOutcome {
  accountId: string
  skipped: SkipReason | null
  /** Null when skipped, or when the scan itself found nothing usable. */
  result: ProcessRepoResult | null
  /** Set when the scan threw. One person's failure never costs the others. */
  error: string | null
}

export interface WorkspaceEvidenceResult {
  workspaceId: string
  repoFullName: string | null
  members: MemberEvidenceOutcome[]
  /** Distinct skills that reached somebody's record on this pass. */
  skillsWritten: number
}

/**
 * Mint evidence for everyone on a project.
 *
 * Called once, when a project is closed out. Not on every verified task: a
 * repository scan per task would be dozens of GitHub round trips for a
 * picture that barely changes between them, and the evidence pipeline is
 * built to describe a body of work rather than a single commit.
 *
 * Each member is scanned independently and their failures are contained. A
 * team of four where one person's GitHub token has expired should still put
 * three records where they belong.
 */
export async function mintWorkspaceEvidence(
  admin: SupabaseClient,
  workspaceId: string,
): Promise<WorkspaceEvidenceResult> {
  const [{ data: repo }, { data: memberRows }, { data: finishedTasks }] = await Promise.all([
    admin
      .from('workspace_repos')
      .select('repo_full_name, installation_id')
      .eq('workspace_id', workspaceId)
      .is('unlinked_at', null)
      .limit(1)
      .maybeSingle(),
    admin
      .from('workspace_members')
      .select('account_id, scan_consent_at')
      .eq('workspace_id', workspaceId)
      .not('accepted_at', 'is', null)
      .is('removed_at', null),
    admin
      .from('tasks')
      // id as well as assignee_id: the counts only need the assignee, but the
      // justification needs to look each task up. Selecting one and reading
      // the other is how the audit trail came back saying "0 tasks" while the
      // evidence it was explaining had just been written.
      .select('id, assignee_id')
      .eq('workspace_id', workspaceId)
      .in('status', FINISHED_STATUSES as unknown as string[]),
  ])

  const empty: WorkspaceEvidenceResult = {
    workspaceId,
    repoFullName: (repo?.repo_full_name as string | null) ?? null,
    members: [],
    skillsWritten: 0,
  }

  // A project cannot leave draft without a repo, so this is close to
  // impossible — but an unlinked one afterwards would land here, and a
  // missing installation is the same problem with a longer name.
  if (!repo?.repo_full_name || !repo.installation_id) return empty

  const members = memberRows ?? []
  if (members.length === 0) return empty

  const verifiedCounts = new Map<string, number>()
  for (const t of finishedTasks ?? []) {
    const id = t.assignee_id as string | null
    if (!id) continue
    verifiedCounts.set(id, (verifiedCounts.get(id) ?? 0) + 1)
  }

  // The justification, per person, gathered once. This is what a dispute
  // reads: not "a scan said so" but "these tasks, against criteria written
  // before the work started, checked on these dates, and these confirmed by
  // a named person".
  const justifications = await gatherJustifications(admin, workspaceId, finishedTasks ?? [])

  // github_username lives on students. Faculty have no row there, which is
  // why the lookup is a left join rather than a filter — a faculty member on
  // a project is skipped with a reason, not silently dropped.
  const { data: studentRows } = await admin
    .from('students')
    .select('id, github_username')
    .in('id', members.map((m) => m.account_id as string))

  const usernames = new Map(
    (studentRows ?? []).map((s) => [s.id as string, s.github_username as string | null]),
  )

  const outcomes: MemberEvidenceOutcome[] = []
  const skills = new Set<string>()

  for (const member of members) {
    const accountId = member.account_id as string
    const input: MemberEvidenceInput = {
      accountId,
      githubUsername: usernames.get(accountId) ?? null,
      scanConsentAt: member.scan_consent_at as string | null,
      verifiedTaskCount: verifiedCounts.get(accountId) ?? 0,
    }

    const skipped = evidenceSkipReason(input)
    if (skipped) {
      outcomes.push({ accountId, skipped, result: null, error: null })
      continue
    }

    try {
      const result = await processRepo(
        admin,
        accountId,
        repo.installation_id as string,
        input.githubUsername!,
        repo.repo_full_name as string,
        // No per-student grant: a workspace holds its repository at workspace
        // level so one installation serves the whole team.
        null,
        { workspaceId },
      )
      for (const written of result.evidenceWritten) skills.add(written.skillId)
      outcomes.push({ accountId, skipped: null, result, error: null })

      await recordEvidenceBasis(admin, {
        accountId,
        workspaceId,
        repoFullName: repo.repo_full_name as string,
        justification: justifications.get(accountId) ?? [],
      })
    } catch (err) {
      // Contained on purpose. One expired token must not cost three other
      // people the record of work they actually did.
      console.error(`[workspace/evidence] scan failed for ${accountId}:`, err)
      outcomes.push({
        accountId,
        skipped: null,
        result: null,
        error: err instanceof Error ? err.message.slice(0, 300) : 'Unknown error',
      })
    }
  }

  return {
    workspaceId,
    repoFullName: repo.repo_full_name as string,
    members: outcomes,
    skillsWritten: skills.size,
  }
}

export interface TaskJustification {
  taskId: string
  title: string
  difficulty: number | null
  acceptanceCriteria: string | null
  verifiedAt: string | null
  /** 'checker' when the automatic pass settled it, 'person' when somebody did. */
  settledBy: 'checker' | 'person' | 'unknown'
  confirmedBy: string | null
  confidence: number | null
  decidedAt: string | null
}

/**
 * What each person's evidence actually rests on.
 *
 * Gathered at minting because it cannot be reconstructed later with any
 * confidence: submissions accumulate, verdicts are overwritten in place, and
 * "which answer was standing on the day the record was written" stops being
 * answerable within a week.
 *
 * The distinction that matters most here is `settledBy`. Evidence resting on
 * a teammate's confirmation is a different claim from evidence the checker
 * settled against CI, and a dispute should be able to see which one it is
 * arguing with.
 */
async function gatherJustifications(
  admin: SupabaseClient,
  workspaceId: string,
  finishedTasks: { id?: unknown; assignee_id?: unknown }[],
): Promise<Map<string, TaskJustification[]>> {
  const out = new Map<string, TaskJustification[]>()
  const taskIds = finishedTasks.map((t) => t.id as string).filter(Boolean)
  if (taskIds.length === 0) return out

  const [{ data: tasks }, { data: submissions }] = await Promise.all([
    admin
      .from('tasks')
      .select('id, title, difficulty, acceptance_criteria, assignee_id, verified_at')
      .in('id', taskIds),
    admin
      .from('task_submissions')
      .select('task_id, verdict, human_verdict, human_actor_id, confidence, decided_at')
      .in('task_id', taskIds)
      .order('submitted_at', { ascending: false }),
  ])

  // The standing answer per task — newest first, first one wins.
  const latest = new Map<string, Record<string, unknown>>()
  for (const row of submissions ?? []) {
    const id = row.task_id as string
    if (!latest.has(id)) latest.set(id, row)
  }

  const confirmerIds = Array.from(latest.values())
    .map((r) => r.human_actor_id as string | null)
    .filter(Boolean) as string[]
  const { data: confirmers } = confirmerIds.length > 0
    ? await admin.from('accounts').select('id, display_name').in('id', confirmerIds)
    : { data: [] }
  const confirmerName = new Map(
    (confirmers ?? []).map((a) => [a.id as string, (a.display_name as string | null) ?? 'A teammate']),
  )

  for (const task of tasks ?? []) {
    const assignee = task.assignee_id as string | null
    if (!assignee) continue
    const submission = latest.get(task.id as string)
    const humanVerdict = submission?.human_verdict as string | null
    const actorId = submission?.human_actor_id as string | null

    out.set(assignee, [...(out.get(assignee) ?? []), {
      taskId: task.id as string,
      title: task.title as string,
      difficulty: task.difficulty as number | null,
      acceptanceCriteria: task.acceptance_criteria as string | null,
      verifiedAt: task.verified_at as string | null,
      settledBy: humanVerdict ? 'person' : submission ? 'checker' : 'unknown',
      confirmedBy: actorId ? (confirmerName.get(actorId) ?? 'A teammate') : null,
      confidence: submission?.confidence == null ? null : Number(submission.confidence),
      decidedAt: (submission?.decided_at as string | null) ?? null,
    }])
  }

  return out
}

/**
 * Write down why this evidence exists, in two places, for two readers.
 *
 * `artifact_signals` is what /me/file shows a student — one line, in words,
 * answering "why does my record say this".
 *
 * `evidence_audit` is what a §611 reinvestigation reads. Workspace evidence
 * would otherwise carry the same audit row as a plain repo scan
 * (`{artifact_id, raw_composite}`), which describes how the number was
 * computed and says nothing about the tasks, the criteria agreed in advance,
 * or the people who confirmed them — the part that makes this evidence
 * stronger than a scan, and therefore the part a dispute is entitled to see.
 *
 * Best-effort. Losing the footnote must never cost somebody the evidence
 * itself; a failure here is logged and the record stands.
 */
async function recordEvidenceBasis(
  admin: SupabaseClient,
  args: {
    accountId: string
    workspaceId: string
    repoFullName: string
    justification: TaskJustification[]
  },
): Promise<void> {
  try {
    const { data: artifact } = await admin
      .from('artifacts')
      .select('id')
      .eq('student_id', args.accountId)
      .eq('workspace_id', args.workspaceId)
      .eq('repo_full_name', args.repoFullName)
      .maybeSingle()
    if (!artifact) return

    const count = args.justification.length
    const confirmed = args.justification.filter((j) => j.settledBy === 'person').length

    await admin
      .from('artifact_signals')
      .delete()
      .eq('artifact_id', artifact.id)
      .eq('signal_name', 'workspace_verified_tasks')

    await admin.from('artifact_signals').insert({
      artifact_id: artifact.id,
      signal_name: 'workspace_verified_tasks',
      value: `${count} task${count === 1 ? '' : 's'} verified against criteria agreed before the work started`
        + (confirmed > 0 ? `, ${confirmed} confirmed by a teammate` : ''),
    })

    // One audit row per evidence row this artifact produced, so a dispute on
    // any single skill finds the basis for that skill rather than a project
    // summary it has to interpret.
    const { data: evidenceRows } = await admin
      .from('skill_evidence')
      .select('id, skill_id')
      .eq('artifact_id', artifact.id)
      .eq('student_id', args.accountId)
      .is('retracted_at', null)

    if (!evidenceRows || evidenceRows.length === 0) return

    await admin.from('evidence_audit').insert(
      evidenceRows.map((row) => ({
        evidence_id: row.id as string,
        source: 'workspace_close',
        raw_input: {
          artifact_id: artifact.id,
          workspace_id: args.workspaceId,
          repo_full_name: args.repoFullName,
          verified_tasks: count,
          confirmed_by_a_person: confirmed,
          // Trimmed: enough to reconstruct the claim, not the whole board.
          tasks: args.justification.slice(0, 40).map((j) => ({
            id: j.taskId,
            title: j.title,
            difficulty: j.difficulty,
            acceptance_criteria: j.acceptanceCriteria?.slice(0, 500) ?? null,
            verified_at: j.verifiedAt,
            settled_by: j.settledBy,
            confirmed_by: j.confirmedBy,
            confidence: j.confidence,
            decided_at: j.decidedAt,
          })),
        },
      })),
    )
  } catch (err) {
    console.error('[workspace/evidence] could not record the basis:', err)
  }
}

/**
 * How many closed projects one nightly pass will try to mint.
 *
 * Each is several GitHub round trips per member, so this is small on
 * purpose. Whatever a night does not reach is still sitting there tomorrow
 * with evidence_minted_at null.
 */
export const MAX_MINTS_PER_SWEEP = 3

/**
 * Finish the records for projects that closed but never got their evidence.
 *
 * Closing sets `evidence_minted_at` when the scan completes. A project that
 * closed while GitHub was slow, or during a deploy, or on a four-person team
 * that outran the function's 60 seconds, has a null there — and without this
 * the only recovery would be a student noticing weeks later that their record
 * never changed.
 *
 * Oldest first, so a project that has been waiting longest stops waiting
 * first.
 */
export async function sweepWorkspaceEvidence(
  admin: SupabaseClient,
  limit: number = MAX_MINTS_PER_SWEEP,
): Promise<{ minted: number; skillsWritten: number; failed: number }> {
  const { data: awaiting } = await admin
    .from('workspaces')
    .select('id')
    .eq('status', 'closed')
    .is('evidence_minted_at', null)
    .order('closed_at')
    .limit(limit)

  let minted = 0
  let skillsWritten = 0
  let failed = 0

  for (const workspace of awaiting ?? []) {
    const id = workspace.id as string
    try {
      const result = await mintWorkspaceEvidence(admin, id)
      skillsWritten += result.skillsWritten
      // Stamped even when the pass wrote nothing. A project where every
      // member was skipped for a good reason — no verified work, no consent,
      // no connected account — is finished, not pending, and leaving it null
      // would retry it every night forever.
      await admin
        .from('workspaces')
        .update({
          evidence_minted_at: new Date().toISOString(),
        })
        .eq('id', id)
      minted++
    } catch (err) {
      // Left unstamped so tomorrow tries again.
      console.error(`[workspace/evidence] nightly mint failed for ${id}:`, err)
      failed++
    }
  }

  return { minted, skillsWritten, failed }
}
