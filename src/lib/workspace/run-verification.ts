// Running one batch of verifications.
//
// Always under the service role. Students may ask for a check and may never
// write its answer — the insert policy on task_submissions pins verdict to
// 'pending', and moving a card into Verified is refused by canMoveTo. A board
// where you can mark your own work verified produces evidence worth nothing,
// so this is the only code that writes a verdict.
//
// The order is deliberate: claim the run, settle everything arithmetic can
// settle, and only then spend a model call on what is left. Most submissions
// never reach the call.

import type { SupabaseClient } from '@supabase/supabase-js'
import { verifyBatch, type VerifierTask } from '@/lib/agents/verifier'
import {
  buildCaseFile, confidenceCeiling, needsHumanReview,
  type EvidenceEvent, type TaskForVerification, type CaseFile,
} from './verify'

export interface RunOutcome {
  checked: number
  verified: number
  needsWork: number
  toAPerson: number
}

interface Decision {
  taskId: string
  submissionId: string
  verdict: 'verified' | 'needs_work' | 'unverifiable'
  confidence: number | null
  note: string
  checks: CaseFile['checks']
}

/**
 * Do the work for one queued run.
 *
 * Claims it first — the manual button and the sweeper both reach for
 * whatever is queued, and a double run would spend twice and could write two
 * verdicts for one submission. A run somebody else already holds returns
 * null, which is not an error.
 */
export async function runVerification(
  admin: SupabaseClient,
  runId: string,
): Promise<RunOutcome | null> {
  const { data: claimed } = await admin.rpc('claim_verification_run', { p_run: runId })
  if (claimed !== true) return null

  try {
    const outcome = await execute(admin, runId)
    await admin
      .from('verification_runs')
      .update({ status: 'complete', finished_at: new Date().toISOString(), task_count: outcome.checked })
      .eq('id', runId)
    return outcome
  } catch (err) {
    console.error('[verify] run failed:', err)
    await admin
      .from('verification_runs')
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        error: err instanceof Error ? err.message.slice(0, 500) : 'Unknown error',
      })
      .eq('id', runId)
    return null
  }
}

async function execute(admin: SupabaseClient, runId: string): Promise<RunOutcome> {
  const { data: run } = await admin
    .from('verification_runs')
    .select('id, workspace_id, triggered_by')
    .eq('id', runId)
    .single()

  const workspaceId = run!.workspace_id as string

  const [{ data: workspace }, { data: taskRows }] = await Promise.all([
    admin.from('workspaces').select('title').eq('id', workspaceId).single(),
    admin
      .from('tasks')
      .select('id, title, acceptance_criteria, verifiable, assignee_id, started_at, created_at, submitted_at')
      .eq('workspace_id', workspaceId)
      .eq('status', 'submitted'),
  ])

  const tasks: TaskForVerification[] = (taskRows ?? []).map((t) => ({
    id: t.id as string,
    title: t.title as string,
    acceptanceCriteria: t.acceptance_criteria as string | null,
    verifiable: t.verifiable as boolean,
    assigneeId: t.assignee_id as string | null,
    startedAt: t.started_at as string | null,
    createdAt: t.created_at as string | null,
    submittedAt: t.submitted_at as string | null,
  }))

  if (tasks.length === 0) return { checked: 0, verified: 0, needsWork: 0, toAPerson: 0 }

  // Everything the workspace has ever recorded. Filtering per task happens in
  // memory because a project is a few thousand rows at most and six separate
  // windowed queries would be six round trips to answer one question.
  const { data: eventRows } = await admin
    .from('work_events')
    .select('event_type, author_account_id, author_login, occurred_at, payload')
    .eq('workspace_id', workspaceId)
    .order('occurred_at')

  const events = (eventRows ?? []) as EvidenceEvent[]

  // How many times each of these has already come back needing work. A board
  // somebody cannot get a card out of is worse than one with no checking.
  const { data: priorRows } = await admin
    .from('task_submissions')
    .select('task_id, verdict')
    .in('task_id', tasks.map((t) => t.id))

  const priorFailures = new Map<string, number>()
  for (const row of priorRows ?? []) {
    if (row.verdict !== 'needs_work') continue
    const id = row.task_id as string
    priorFailures.set(id, (priorFailures.get(id) ?? 0) + 1)
  }

  const submittedBy = (run!.triggered_by as string | null) ?? null
  const decisions: Decision[] = []
  const forModel: VerifierTask[] = []
  const caseFiles = new Map<string, CaseFile>()

  // One submission row per task per run, created up front so a verdict always
  // has a row to land on and a crash leaves visible pending work rather than
  // silence.
  for (const task of tasks) {
    const caseFile = buildCaseFile(task, events)
    caseFiles.set(task.id, caseFile)

    const attempt = (priorFailures.get(task.id) ?? 0) + 1
    const { data: submission } = await admin
      .from('task_submissions')
      .insert({
        workspace_id: workspaceId,
        task_id: task.id,
        submitted_by: task.assigneeId ?? submittedBy,
        run_id: runId,
        verdict: 'pending',
        checks: caseFile.checks,
        attempt,
      })
      .select('id')
      .single()

    if (!submission) continue
    const submissionId = submission.id as string

    if (needsHumanReview(priorFailures.get(task.id) ?? 0)) {
      decisions.push({
        taskId: task.id, submissionId, verdict: 'unverifiable', confidence: null,
        note: 'This has come back needing work twice. A teammate should look at it rather than the checker.',
        checks: caseFile.checks,
      })
      continue
    }

    if (caseFile.earlyVerdict) {
      decisions.push({
        taskId: task.id, submissionId, verdict: caseFile.earlyVerdict,
        confidence: caseFile.earlyVerdict === 'needs_work' ? 1 : null,
        note: caseFile.earlyReason ?? '', checks: caseFile.checks,
      })
      continue
    }

    forModel.push({
      taskId: task.id,
      title: task.title,
      acceptanceCriteria: task.acceptanceCriteria,
      caseFile,
    })
    decisions.push({
      taskId: task.id, submissionId, verdict: 'needs_work', confidence: null,
      note: '', checks: caseFile.checks,
    })
  }

  // The one call. Everything above was free.
  if (forModel.length > 0) {
    const verdicts = await verifyBatch(
      admin,
      submittedBy ?? tasks[0].assigneeId ?? '',
      (workspace?.title as string) ?? 'Project',
      forModel,
    )

    if (verdicts === null) {
      // No answer, so no verdict. Leaving these pending is the honest state:
      // the run failed, not the work.
      throw new Error('The verifier did not return a usable answer.')
    }

    for (const verdict of verdicts) {
      const decision = decisions.find((d) => d.taskId === verdict.taskId)
      if (!decision) continue
      // The checks are facts; the model's judgement sits on top of them. A
      // persuasive commit message must not talk a task past red CI.
      const ceiling = confidenceCeiling(caseFiles.get(verdict.taskId)?.checks ?? [])
      const confidence = Math.min(verdict.confidence, ceiling)
      decision.verdict = confidence < 0.5 && verdict.verdict === 'verified' ? 'needs_work' : verdict.verdict
      decision.confidence = Math.round(confidence * 100) / 100
      decision.note = verdict.note
    }

    // A task the model silently skipped keeps no verdict rather than a
    // guessed one.
    for (const task of forModel) {
      const decision = decisions.find((d) => d.taskId === task.taskId)
      if (decision && decision.confidence === null) {
        decision.verdict = 'unverifiable'
        decision.note = 'The checker did not reach an answer on this one. A teammate can confirm it.'
      }
    }
  }

  let verified = 0, needsWork = 0, toAPerson = 0

  for (const decision of decisions) {
    await admin
      .from('task_submissions')
      .update({
        verdict: decision.verdict,
        confidence: decision.confidence,
        notes: decision.note,
        checks: decision.checks,
        decided_at: new Date().toISOString(),
      })
      .eq('id', decision.submissionId)

    if (decision.verdict === 'verified') {
      verified++
      // The only place a task reaches Verified. The trigger stamps
      // verified_at and writes the transition.
      await admin.from('tasks').update({ status: 'verified' }).eq('id', decision.taskId)
    } else if (decision.verdict === 'needs_work') {
      needsWork++
      // Back to Doing, so the board shows work outstanding rather than a
      // card sitting in Submitted with a quiet failure attached to it.
      await admin.from('tasks').update({ status: 'doing' }).eq('id', decision.taskId)
    } else {
      toAPerson++
      // Left in Submitted: it is waiting on a person, not on the student.
    }
  }

  return { checked: decisions.length, verified, needsWork, toAPerson }
}
