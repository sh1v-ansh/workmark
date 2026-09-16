// What has happened on a project so far, as one read.
//
// ── Why this is a read and not a scan ─────────────────────────────────────
// The obvious way to decide what a student should do next is to look at
// their commits and work out what is finished. That is the wrong shape, for
// one reason that matters more than cost: the verifier has already answered
// that question, per task, and told the student the answer. A planner that
// re-derives it from the same commits can reach a different conclusion, and
// then Workmark says a task is done on Monday and not done on Wednesday.
//
// So: one place decides whether work is done — the verifier, at submission,
// from the CaseFile it builds out of work_events. Everything downstream reads
// that decision and never re-derives it.
//
// What is left is assembling decisions already made, which is pure SQL and
// costs nothing. This is the input to re-planning, sprint kickoff, sprint
// retro, and "I have finished early, give me more" — four features, one
// query, one place to cache a prompt.
//
// ── What makes it feel senior rather than generative ──────────────────────
// The notes and reasons, not the counts. "Your last two tasks came back on
// async error handling" is a different thing from "here are three more
// tasks", and the difference is entirely in whether the model was handed
// task_submissions.notes, blocked_reason and the revision reasons. Those
// fields are the reason this type is as wide as it is.

import type { SupabaseClient } from '@supabase/supabase-js'
import { TERMINAL_STATUSES, type TaskStatus } from './tasks'

export interface StateTask {
  id: string
  title: string
  status: TaskStatus
  difficulty: number | null
  estimateHours: number | null
  dueOn: string | null
  assigneeId: string | null
  startedAt: string | null
  /** Set and non-null only while the card is stuck. */
  blockedReason: string | null
  /** Why it was set aside, when it was. */
  abandonedReason: string | null
  /** The most recent verdict, and what the checker said about it. */
  latestVerdict: string | null
  verdictNote: string | null
  /** How many times it has been submitted. Two means a person is needed. */
  attempts: number
}

export interface StateRevision {
  taskId: string
  field: string
  oldValue: string | null
  newValue: string | null
  /** The student's own words on why an estimate or deadline moved. */
  reason: string | null
  changedAt: string | null
}

export interface ProjectState {
  workspaceId: string
  title: string
  status: string
  deadline: string | null
  /** Every task, in one list. Callers group it; see the helpers below. */
  tasks: StateTask[]
  /** Estimate and deadline changes, with the reasons given. */
  revisions: StateRevision[]
}

/**
 * Everything the planner needs, in four queries.
 *
 * Deliberately not paginated. A workspace holds at most four people and a
 * board nobody sane lets past a few dozen cards, so the whole project is a
 * small read — and a planner shown half a board plans against half a board.
 */
export async function loadProjectState(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<ProjectState | null> {
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, title, status, deadline')
    .eq('id', workspaceId)
    .maybeSingle()

  if (!workspace) return null

  const [{ data: taskRows }, { data: submissionRows }, { data: revisionRows }] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, title, status, difficulty, estimate_hours, due_on, assignee_id, started_at, blocked_at, blocked_reason, abandoned_reason')
      .eq('workspace_id', workspaceId),
    supabase
      .from('task_submissions')
      .select('task_id, verdict, notes, attempt, submitted_at')
      .eq('workspace_id', workspaceId)
      .order('submitted_at', { ascending: false }),
    supabase
      .from('task_revisions')
      .select('task_id, field, old_value, new_value, reason, changed_at')
      .eq('workspace_id', workspaceId)
      .order('changed_at', { ascending: false })
      .limit(100),
  ])

  // Newest submission per task wins, and the attempt count comes from the
  // same pass. Two attempts is the number that means the checker has given
  // up and a person is needed, so it is worth the planner knowing.
  const latest = new Map<string, { verdict: string; notes: string | null }>()
  const attempts = new Map<string, number>()
  for (const row of submissionRows ?? []) {
    const taskId = row.task_id as string
    attempts.set(taskId, (attempts.get(taskId) ?? 0) + 1)
    if (!latest.has(taskId)) {
      latest.set(taskId, {
        verdict: row.verdict as string,
        notes: row.notes as string | null,
      })
    }
  }

  const tasks: StateTask[] = (taskRows ?? []).map((t) => ({
    id: t.id as string,
    title: t.title as string,
    status: t.status as TaskStatus,
    difficulty: t.difficulty as number | null,
    estimateHours: t.estimate_hours === null ? null : Number(t.estimate_hours),
    dueOn: t.due_on as string | null,
    assigneeId: t.assignee_id as string | null,
    startedAt: t.started_at as string | null,
    // Only while it is actually stuck. A reason left behind by an unblock is
    // history, and reading it as current would have the planner working
    // around an obstacle somebody cleared last week.
    blockedReason: t.blocked_at ? (t.blocked_reason as string | null) : null,
    abandonedReason: t.abandoned_reason as string | null,
    latestVerdict: latest.get(t.id as string)?.verdict ?? null,
    verdictNote: latest.get(t.id as string)?.notes ?? null,
    attempts: attempts.get(t.id as string) ?? 0,
  }))

  return {
    workspaceId: workspace.id as string,
    title: workspace.title as string,
    status: workspace.status as string,
    deadline: workspace.deadline as string | null,
    tasks,
    revisions: (revisionRows ?? []).map((r) => ({
      taskId: r.task_id as string,
      field: r.field as string,
      oldValue: r.old_value as string | null,
      newValue: r.new_value as string | null,
      reason: r.reason as string | null,
      changedAt: r.changed_at as string | null,
    })),
  }
}

// ── The questions everything downstream actually asks ─────────────────────
// Pure, and separate from the read above, so the definitions of "done" and
// "in flight" have one home and can be tested without a database. Four
// features are about to depend on these agreeing.

/** Finished and it counts: the work that will reach the record. */
export function completed(state: ProjectState): StateTask[] {
  return state.tasks.filter((t) => t.status === 'verified' || t.status === 'accepted')
}

/** Started and not finished, in any sense. */
export function inFlight(state: ProjectState): StateTask[] {
  return state.tasks.filter((t) => t.status === 'doing' || t.status === 'submitted')
}

/** Agreed to and not started. */
export function notStarted(state: ProjectState): StateTask[] {
  return state.tasks.filter((t) => t.status === 'backlog' || t.status === 'planned')
}

/** Open work of any kind, which is what "is this board running dry" means. */
export function open(state: ProjectState): StateTask[] {
  return state.tasks.filter((t) => !TERMINAL_STATUSES.includes(t.status))
}

/** Tried and set aside, with the finding that came out of it. */
export function setAside(state: ProjectState): StateTask[] {
  return state.tasks.filter((t) => t.status === 'abandoned')
}

/** Stuck right now, and why. */
export function blocked(state: ProjectState): StateTask[] {
  return state.tasks.filter((t) => t.blockedReason !== null)
}

/**
 * Submitted and waiting on somebody.
 *
 * The guard on "give me more work". A student with four of these does not
 * need a bigger board, they need somebody to look at what they have already
 * done — and generating more would turn the completion figures that make
 * their record mean anything into noise.
 */
export function awaitingSomeone(state: ProjectState): StateTask[] {
  return state.tasks.filter((t) => t.status === 'submitted')
}

/**
 * What came back, and what the checker said about it.
 *
 * The single most useful thing to hand a planner. A model that knows two
 * tasks failed on the same theme writes a different next task from one that
 * only sees a count.
 */
export function setbacks(state: ProjectState): { title: string; note: string | null }[] {
  return state.tasks
    .filter((t) => t.latestVerdict === 'needs_work' || t.status === 'abandoned')
    .map((t) => ({
      title: t.title,
      note: t.status === 'abandoned' ? t.abandonedReason : t.verdictNote,
    }))
}
