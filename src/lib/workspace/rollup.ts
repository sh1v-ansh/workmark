// The nightly rollup.
//
// Reads a project's whole history and writes one row per person. Service
// role throughout: a student who could write their own capability frontier
// could write anything, so workspace_metrics has no insert policy at all.
//
// Cheap by construction. Four queries per project regardless of how many
// people are on it, and the arithmetic happens in memory — the alternative
// is a query per person per metric, which is how a nightly job becomes a
// nightly outage.

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  computeMetrics,
  type MetricTask, type MetricTransition, type MetricRevision, type MetricSubmission,
} from './metrics'
import type { TaskStatus } from './tasks'
import type { WorkRole } from './membership'

export interface RollupResult {
  workspaces: number
  people: number
}

/** One project. Returns how many people got a row. */
export async function rollupWorkspace(
  admin: SupabaseClient,
  workspaceId: string,
  now: Date = new Date(),
): Promise<number> {
  const [{ data: memberRows }, { data: taskRows }, { data: transitionRows }, { data: revisionRows }, { data: submissionRows }] =
    await Promise.all([
      admin
        .from('workspace_members')
        .select('account_id, work_role')
        .eq('workspace_id', workspaceId)
        .not('accepted_at', 'is', null),
      admin
        .from('tasks')
        .select('id, assignee_id, status, origin, estimate_hours, difficulty, due_on, verifiable, suggested_role, created_at, blocked_at')
        .eq('workspace_id', workspaceId),
      admin
        .from('task_transitions')
        .select('task_id, to_status, occurred_at')
        .eq('workspace_id', workspaceId),
      admin
        .from('task_revisions')
        .select('task_id, field, old_value, new_value, reason, changed_at')
        .eq('workspace_id', workspaceId),
      admin
        .from('task_submissions')
        .select('task_id, verdict, attempt, decided_at')
        .eq('workspace_id', workspaceId),
    ])

  const members = memberRows ?? []
  if (members.length === 0) return 0

  // A member's own work role is what a task belongs to when the task does not
  // name one — an unlabelled task done by the backend person is backend work.
  const roleOf = new Map(members.map((m) => [m.account_id as string, m.work_role as WorkRole | null]))

  const allTasks: MetricTask[] = (taskRows ?? []).map((t) => ({
    id: t.id as string,
    assigneeId: t.assignee_id as string | null,
    status: t.status as TaskStatus,
    origin: t.origin as string,
    estimateHours: t.estimate_hours === null ? null : Number(t.estimate_hours),
    difficulty: t.difficulty as number | null,
    dueOn: t.due_on as string | null,
    verifiable: t.verifiable as boolean,
    workRole: (t.suggested_role as WorkRole | null) ?? roleOf.get(t.assignee_id as string) ?? null,
    createdAt: t.created_at as string | null,
    blockedAt: t.blocked_at as string | null,
  }))

  const transitions: MetricTransition[] = (transitionRows ?? []).map((t) => ({
    taskId: t.task_id as string,
    toStatus: t.to_status as string,
    occurredAt: t.occurred_at as string,
  }))
  const revisions: MetricRevision[] = (revisionRows ?? []).map((r) => ({
    taskId: r.task_id as string,
    field: r.field as string,
    oldValue: r.old_value as string | null,
    newValue: r.new_value as string | null,
    reason: r.reason as string | null,
    changedAt: r.changed_at as string,
  }))
  const submissions: MetricSubmission[] = (submissionRows ?? []).map((s) => ({
    taskId: s.task_id as string,
    verdict: s.verdict as string,
    attempt: Number(s.attempt ?? 1),
    decidedAt: s.decided_at as string | null,
  }))

  const rows = members.map((member) => {
    const accountId = member.account_id as string
    // Their tasks. On a solo project that is everything; on a team it is
    // what they were actually responsible for, which is the only honest
    // basis for a number about a person.
    const theirs = allTasks.filter((t) => t.assigneeId === accountId)
    const theirIds = new Set(theirs.map((t) => t.id))

    const metrics = computeMetrics(
      theirs,
      transitions.filter((t) => theirIds.has(t.taskId)),
      revisions.filter((r) => theirIds.has(r.taskId)),
      submissions.filter((s) => theirIds.has(s.taskId)),
      now,
    )

    return {
      workspace_id: workspaceId,
      account_id: accountId,
      metrics: metrics as unknown as Record<string, unknown>,
      tasks_completed: metrics.technical.completed,
      difficulty_weighted: metrics.technical.difficultyWeighted,
      capability_frontier: metrics.technical.capabilityFrontier,
      on_time_rate: metrics.execution.onTimeRate.value,
      estimate_bias: metrics.estimation.bias.value,
      computed_at: now.toISOString(),
    }
  })

  const { error } = await admin
    .from('workspace_metrics')
    .upsert(rows, { onConflict: 'workspace_id,account_id' })

  if (error) {
    console.error('[rollup] upsert failed for', workspaceId, error)
    return 0
  }
  return rows.length
}

/**
 * Every project that has been worked on.
 *
 * Drafts are skipped — there is nothing to measure before a project starts —
 * and so is anything closed long enough ago that its numbers cannot change.
 * Recomputing a finished project every night forever is the kind of cost that
 * grows quietly and never comes back down.
 */
export async function rollupAll(
  admin: SupabaseClient,
  limit = 200,
  now: Date = new Date(),
): Promise<RollupResult> {
  const staleBefore = new Date(now.getTime() - 30 * 86_400_000).toISOString()

  const { data: workspaces } = await admin
    .from('workspaces')
    .select('id, status, closed_at')
    .neq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(limit)

  let people = 0
  let counted = 0

  for (const workspace of workspaces ?? []) {
    const closedAt = workspace.closed_at as string | null
    if (closedAt && closedAt < staleBefore) continue
    people += await rollupWorkspace(admin, workspace.id as string, now)
    counted++
  }

  return { workspaces: counted, people }
}
