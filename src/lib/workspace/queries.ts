// Reading workspaces.
//
// Every query here runs through the caller's own session, never the service
// role, so RLS is what decides what comes back. A workspace someone is not a
// member of returns nothing rather than a 403 — which is the right answer:
// they cannot be told it exists.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { MemberRole, WorkRole } from './membership'
import type { TaskStatus, TaskPriority } from './tasks'
import type { WorkspaceMetrics } from './metrics'

export type WorkspaceStatus = 'draft' | 'active' | 'submitted' | 'closed' | 'abandoned'

export interface WorkspaceSummary {
  id: string
  title: string
  summary: string | null
  status: WorkspaceStatus
  deadline: string | null
  createdAt: string | null
  startedAt: string | null
  memberCount: number
  repoFullName: string | null
}

export interface TeamMember {
  accountId: string
  name: string | null
  handle: string | null
  role: MemberRole
  workRole: WorkRole | null
  acceptedAt: string | null
  invitedAt: string | null
  isYou: boolean
}

export interface WorkspaceDetail extends WorkspaceSummary {
  members: TeamMember[]
  /** Pending invitations, kept separate: they are not the team yet. */
  invited: TeamMember[]
  yourRole: MemberRole | null
}

export interface PendingInvitation {
  workspaceId: string
  title: string
  summary: string | null
  invitedAt: string | null
  invitedByName: string | null
}

/**
 * Names for a set of account ids.
 *
 * accounts.display_name is the one place every kind of user has a name —
 * faculty have no student row, so joining through `students` would leave
 * some members anonymous.
 */
async function namesFor(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, { name: string | null; handle: string | null }>> {
  const unique = Array.from(new Set(ids)).filter(Boolean)
  if (unique.length === 0) return new Map()

  const [{ data: accounts }, { data: students }] = await Promise.all([
    supabase.from('accounts').select('id, display_name').in('id', unique),
    supabase.from('students').select('id, handle, full_name').in('id', unique),
  ])

  const handles = new Map((students ?? []).map((s) => [s.id as string, s]))
  return new Map(unique.map((id) => {
    const student = handles.get(id)
    const account = (accounts ?? []).find((a) => a.id === id)
    return [id, {
      name: (account?.display_name as string | null) ?? (student?.full_name as string | null) ?? null,
      handle: (student?.handle as string | null) ?? null,
    }]
  }))
}

/** Every project this person is actually on. Invitations are listed separately. */
export async function listWorkspaces(
  supabase: SupabaseClient,
  userId: string,
): Promise<WorkspaceSummary[]> {
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('account_id', userId)
    .not('accepted_at', 'is', null)
    .is('removed_at', null)

  const ids = (memberships ?? []).map((m) => m.workspace_id as string)
  if (ids.length === 0) return []

  const [{ data: workspaces }, { data: allMembers }, { data: repos }] = await Promise.all([
    supabase
      .from('workspaces')
      .select('id, title, summary, status, deadline, created_at, started_at')
      .in('id', ids)
      .order('created_at', { ascending: false }),
    supabase
      .from('workspace_members')
      .select('workspace_id')
      .in('workspace_id', ids)
      .not('accepted_at', 'is', null)
      .is('removed_at', null),
    supabase
      .from('workspace_repos')
      .select('workspace_id, repo_full_name')
      .in('workspace_id', ids)
      .is('unlinked_at', null),
  ])

  const counts = new Map<string, number>()
  for (const m of allMembers ?? []) {
    const key = m.workspace_id as string
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const repoByWorkspace = new Map((repos ?? []).map((r) => [r.workspace_id as string, r.repo_full_name as string]))

  return (workspaces ?? []).map((w) => ({
    id: w.id as string,
    title: w.title as string,
    summary: w.summary as string | null,
    status: w.status as WorkspaceStatus,
    deadline: w.deadline as string | null,
    createdAt: w.created_at as string | null,
    startedAt: w.started_at as string | null,
    memberCount: counts.get(w.id as string) ?? 0,
    repoFullName: repoByWorkspace.get(w.id as string) ?? null,
  }))
}

/** One project, with its team. Null when the caller cannot see it. */
export async function loadWorkspace(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
): Promise<WorkspaceDetail | null> {
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, title, summary, status, deadline, created_at, started_at')
    .eq('id', workspaceId)
    .maybeSingle()
  if (!workspace) return null

  const [{ data: memberRows }, { data: repos }] = await Promise.all([
    supabase
      .from('workspace_members')
      .select('account_id, role, work_role, accepted_at, invited_at')
      .eq('workspace_id', workspaceId)
      .is('removed_at', null)
      .order('invited_at'),
    supabase
      .from('workspace_repos')
      .select('repo_full_name')
      .eq('workspace_id', workspaceId)
      .is('unlinked_at', null)
      .limit(1),
  ])

  const rows = memberRows ?? []
  const names = await namesFor(supabase, rows.map((r) => r.account_id as string))

  const toMember = (r: Record<string, unknown>): TeamMember => {
    const id = r.account_id as string
    return {
      accountId: id,
      name: names.get(id)?.name ?? null,
      handle: names.get(id)?.handle ?? null,
      role: r.role as MemberRole,
      workRole: (r.work_role as WorkRole | null) ?? null,
      acceptedAt: r.accepted_at as string | null,
      invitedAt: r.invited_at as string | null,
      isYou: id === userId,
    }
  }

  const members = rows.filter((r) => r.accepted_at !== null).map(toMember)
  const invited = rows.filter((r) => r.accepted_at === null).map(toMember)

  return {
    id: workspace.id as string,
    title: workspace.title as string,
    summary: workspace.summary as string | null,
    status: workspace.status as WorkspaceStatus,
    deadline: workspace.deadline as string | null,
    createdAt: workspace.created_at as string | null,
    startedAt: workspace.started_at as string | null,
    memberCount: members.length,
    repoFullName: (repos ?? [])[0]?.repo_full_name as string ?? null,
    members,
    invited,
    yourRole: members.find((m) => m.isYou)?.role ?? null,
  }
}

/**
 * Invitations waiting to be answered.
 *
 * The half of the flow that is easiest to forget to build, and without which
 * the invite feature does nothing: an invitation nobody can find is a row.
 */
export async function pendingInvitations(
  supabase: SupabaseClient,
  userId: string,
): Promise<PendingInvitation[]> {
  const { data: rows } = await supabase
    .from('workspace_members')
    .select('workspace_id, invited_at, invited_by')
    .eq('account_id', userId)
    .is('accepted_at', null)
    .is('removed_at', null)

  const ids = (rows ?? []).map((r) => r.workspace_id as string)
  if (ids.length === 0) return []

  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, title, summary')
    .in('id', ids)

  const names = await namesFor(supabase, (rows ?? []).map((r) => r.invited_by as string).filter(Boolean))
  const byId = new Map((workspaces ?? []).map((w) => [w.id as string, w]))

  return (rows ?? []).flatMap((r) => {
    const workspace = byId.get(r.workspace_id as string)
    // RLS lets somebody read their own pending membership row before they
    // are a member, but not the workspace behind it. Skip rather than
    // render a card with no title on it.
    if (!workspace) return []
    return [{
      workspaceId: workspace.id as string,
      title: workspace.title as string,
      summary: workspace.summary as string | null,
      invitedAt: r.invited_at as string | null,
      invitedByName: names.get(r.invited_by as string)?.name ?? null,
    }]
  })
}

export interface BoardTask {
  id: string
  title: string
  detail: string | null
  acceptanceCriteria: string | null
  status: TaskStatus
  priority: TaskPriority
  assigneeId: string | null
  suggestedRole: WorkRole | null
  estimateHours: number | null
  difficulty: number | null
  dueOn: string | null
  verifiable: boolean
  position: number
  blockedAt: string | null
  blockedReason: string | null
  origin: string
  createdAt: string | null
  startedAt: string | null
}

/**
 * Every task on a project, in one query.
 *
 * The board is not paginated and should not become so. Four people and a
 * cap on how much work fits in a student project means a few dozen rows;
 * the index on (workspace_id, status, position) makes this a single scan,
 * and splitting it per column would be six round trips to render one screen.
 */
export async function loadBoard(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<BoardTask[]> {
  const { data } = await supabase
    .from('tasks')
    // One literal, not a concatenation: supabase-js infers the row type from
    // the select string, and joining two pieces at runtime leaves it with
    // nothing to read.
    .select('id, title, detail, acceptance_criteria, status, priority, assignee_id, suggested_role, estimate_hours, difficulty, due_on, verifiable, position, blocked_at, blocked_reason, origin, created_at, started_at')
    .eq('workspace_id', workspaceId)
    .order('position')

  return (data ?? []).map((t) => ({
    id: t.id as string,
    title: t.title as string,
    detail: t.detail as string | null,
    acceptanceCriteria: t.acceptance_criteria as string | null,
    status: t.status as TaskStatus,
    priority: t.priority as TaskPriority,
    assigneeId: t.assignee_id as string | null,
    suggestedRole: t.suggested_role as WorkRole | null,
    estimateHours: t.estimate_hours === null ? null : Number(t.estimate_hours),
    difficulty: t.difficulty as number | null,
    dueOn: t.due_on as string | null,
    verifiable: t.verifiable as boolean,
    position: Number(t.position),
    blockedAt: t.blocked_at as string | null,
    blockedReason: t.blocked_reason as string | null,
    origin: t.origin as string,
    createdAt: t.created_at as string | null,
    startedAt: t.started_at as string | null,
  }))
}

export interface TaskVerdict {
  taskId: string
  verdict: 'pending' | 'verified' | 'needs_work' | 'unverifiable' | 'human_verified'
  confidence: number | null
  notes: string | null
  checks: { id: string; label: string; status: string; detail: string }[]
  attempt: number
  decidedAt: string | null
}

/**
 * The most recent answer for each task.
 *
 * One query for the whole board rather than one per card. Ordered newest
 * first and deduped in memory: a task can have several submissions and only
 * the last one is what the board should show.
 */
export async function loadVerdicts(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<Map<string, TaskVerdict>> {
  const { data } = await supabase
    .from('task_submissions')
    .select('task_id, verdict, confidence, notes, checks, attempt, decided_at, submitted_at')
    .eq('workspace_id', workspaceId)
    .order('submitted_at', { ascending: false })

  const latest = new Map<string, TaskVerdict>()
  for (const row of data ?? []) {
    const taskId = row.task_id as string
    if (latest.has(taskId)) continue
    latest.set(taskId, {
      taskId,
      verdict: row.verdict as TaskVerdict['verdict'],
      confidence: row.confidence === null ? null : Number(row.confidence),
      notes: row.notes as string | null,
      checks: Array.isArray(row.checks) ? row.checks as TaskVerdict['checks'] : [],
      attempt: Number(row.attempt ?? 1),
      decidedAt: row.decided_at as string | null,
    })
  }
  return latest
}

/**
 * This person's plan-vs-reality row for one project.
 *
 * Read, never computed. The nightly rollup writes it; a page that
 * recalculated on load would be slowest for the students who had done the
 * most work, which is precisely backwards.
 */
export async function loadMetrics(
  supabase: SupabaseClient,
  workspaceId: string,
  accountId: string,
): Promise<{ metrics: WorkspaceMetrics; computedAt: string } | null> {
  const { data } = await supabase
    .from('workspace_metrics')
    .select('metrics, computed_at')
    .eq('workspace_id', workspaceId)
    .eq('account_id', accountId)
    .maybeSingle()

  if (!data?.metrics) return null
  return {
    metrics: data.metrics as unknown as WorkspaceMetrics,
    computedAt: data.computed_at as string,
  }
}
