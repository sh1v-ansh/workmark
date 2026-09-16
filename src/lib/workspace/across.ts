// One person's figures across every project they have worked on.
//
// ── Why this is not an average of the per-project rows ────────────────────
// `workspace_metrics` already holds a computed row per person per project,
// and the obvious thing is to average them. It is wrong, and quietly.
//
// Almost every figure here is a median — estimate bias, days late, attempts
// to pass. The median of three medians is not the median of the underlying
// data, and it is not an approximation of it either: a project with two tasks
// and one with forty count equally, so one bad week on a tiny project moves a
// student's headline number as much as a term of work.
//
// The rates have the same problem from the other side. Three projects at
// 100%, 100% and 50% do not make 83% on-time — they make whatever the pooled
// count says, which could be anything depending on how many commitments each
// project held.
//
// So this pools the raw rows and runs `computeMetrics` once over all of them.
// One function, the same arithmetic the per-project figures use, no second
// definition of what any of these numbers mean. MIN_SAMPLE then applies to
// the pooled sample, which is the honest place for it: somebody with two
// tasks on each of three projects still has six tasks, and that is the
// question the floor is asking.
//
// ── What the per-project rows are still for ───────────────────────────────
// Kept and shown underneath, because "you underestimate" and "you
// underestimate on backend work, on that one project, in the week you were
// also moving house" are different claims. The pooled figure is the headline;
// the breakdown is what makes it arguable.

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  computeMetrics,
  type MetricTask, type MetricTransition, type MetricRevision, type MetricSubmission,
  type WorkspaceMetrics,
} from './metrics'
import { countable } from './subtasks'
import type { TaskStatus } from './tasks'
import type { WorkRole } from './membership'

/**
 * How many projects are pooled.
 *
 * A student with more than this has a record that is not going to change
 * shape from the twenty-first, and the query is run on a page load.
 */
export const MAX_PROJECTS = 20

export interface ProjectFigures {
  workspaceId: string
  title: string
  status: string
  /** Their tasks on this project that count — leaves only. */
  taskCount: number
  metrics: WorkspaceMetrics
}

export interface AcrossProjects {
  /** Every project pooled into one set of figures. */
  overall: WorkspaceMetrics
  /** The same arithmetic per project, newest first. */
  perProject: ProjectFigures[]
  projectCount: number
}

/**
 * Everything, computed from the raw rows rather than from the summaries.
 *
 * Returns null for somebody who has not been on a project, which is most
 * students on their first visit — the caller shows nothing rather than a
 * panel of empty figures, because a page of nulls reads as broken.
 */
export async function loadAcrossProjects(
  supabase: SupabaseClient,
  accountId: string,
  now: Date = new Date(),
): Promise<AcrossProjects | null> {
  // Accepted members only, and not removed. Being invited to a project is not
  // having worked on one.
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, workspaces(id, title, status, created_at)')
    .eq('account_id', accountId)
    .not('accepted_at', 'is', null)
    .is('removed_at', null)
    .limit(MAX_PROJECTS)

  const projects = (memberships ?? [])
    .map((m) => m.workspaces as unknown as { id: string; title: string; status: string; created_at: string } | null)
    .filter((w): w is { id: string; title: string; status: string; created_at: string } => w !== null)
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))

  if (projects.length === 0) return null

  const ids = projects.map((p) => p.id)

  const [{ data: taskRows }, { data: transitionRows }, { data: revisionRows }, { data: submissionRows }] =
    await Promise.all([
      supabase
        .from('tasks')
        .select('id, workspace_id, parent_task_id, assignee_id, status, origin, estimate_hours, difficulty, due_on, verifiable, suggested_role, created_at, blocked_at')
        .in('workspace_id', ids),
      supabase
        .from('task_transitions')
        .select('task_id, to_status, occurred_at')
        .in('workspace_id', ids),
      supabase
        .from('task_revisions')
        .select('task_id, field, old_value, new_value, reason, changed_at')
        .in('workspace_id', ids),
      supabase
        .from('task_submissions')
        .select('task_id, verdict, attempt, decided_at')
        .in('workspace_id', ids),
    ])

  // Leaves only, decided across the whole board rather than within one
  // person's share of it — a parent assigned to somebody else with its
  // children assigned here would otherwise be counted as work. Same rule and
  // same reason as rollup.ts.
  const leafIds = new Set(
    countable((taskRows ?? []).map((t) => ({
      id: t.id as string,
      parentTaskId: (t.parent_task_id as string | null) ?? null,
      status: t.status as string,
      createdAt: null,
      startedAt: null,
    }))).map((t) => t.id),
  )

  const mine: (MetricTask & { workspaceId: string })[] = (taskRows ?? [])
    .filter((t) => t.assignee_id === accountId && leafIds.has(t.id as string))
    .map((t) => ({
      id: t.id as string,
      workspaceId: t.workspace_id as string,
      parentTaskId: (t.parent_task_id as string | null) ?? null,
      assigneeId: t.assignee_id as string | null,
      status: t.status as TaskStatus,
      origin: t.origin as string,
      estimateHours: t.estimate_hours === null ? null : Number(t.estimate_hours),
      difficulty: t.difficulty as number | null,
      dueOn: t.due_on as string | null,
      verifiable: t.verifiable as boolean,
      workRole: (t.suggested_role as WorkRole | null) ?? null,
      createdAt: t.created_at as string | null,
      blockedAt: t.blocked_at as string | null,
    }))

  if (mine.length === 0) return null

  const myTaskIds = new Set(mine.map((t) => t.id))
  const transitions: MetricTransition[] = (transitionRows ?? [])
    .filter((t) => myTaskIds.has(t.task_id as string))
    .map((t) => ({
      taskId: t.task_id as string,
      toStatus: t.to_status as string,
      occurredAt: t.occurred_at as string,
    }))
  const revisions: MetricRevision[] = (revisionRows ?? [])
    .filter((r) => myTaskIds.has(r.task_id as string))
    .map((r) => ({
      taskId: r.task_id as string,
      field: r.field as string,
      oldValue: r.old_value as string | null,
      newValue: r.new_value as string | null,
      reason: r.reason as string | null,
      changedAt: r.changed_at as string,
    }))
  const submissions: MetricSubmission[] = (submissionRows ?? [])
    .filter((s) => myTaskIds.has(s.task_id as string))
    .map((s) => ({
      taskId: s.task_id as string,
      verdict: s.verdict as string,
      attempt: Number(s.attempt ?? 1),
      decidedAt: s.decided_at as string | null,
    }))

  // The pooled figure: every row, once, through the same function the
  // per-project numbers come from.
  const overall = computeMetrics(mine, transitions, revisions, submissions, now)

  const perProject: ProjectFigures[] = projects
    .map((project) => {
      const theirs = mine.filter((t) => t.workspaceId === project.id)
      if (theirs.length === 0) return null
      const ids = new Set(theirs.map((t) => t.id))
      return {
        workspaceId: project.id,
        title: project.title,
        status: project.status,
        taskCount: theirs.length,
        metrics: computeMetrics(
          theirs,
          transitions.filter((t) => ids.has(t.taskId)),
          revisions.filter((r) => ids.has(r.taskId)),
          submissions.filter((s) => ids.has(s.taskId)),
          now,
        ),
      }
    })
    .filter((row): row is ProjectFigures => row !== null)

  return { overall, perProject, projectCount: perProject.length }
}
