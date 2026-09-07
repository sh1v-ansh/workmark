import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { enforce } from '@/lib/rate-limit'
import { agentsAvailable } from '@/lib/agents/client'
import { checkAgentRateLimit } from '@/lib/agents/rate-limit'
import { planProject } from '@/lib/agents/planner'
import { assigneeForRole, type MemberRow, type WorkRole } from '@/lib/workspace/membership'
import { POSITION_STEP } from '@/lib/workspace/tasks'
import { requireUuid, ValidationError } from '@/lib/http/validate'

/**
 * POST /api/workspaces/[id]/plan — draft a plan.
 *
 * One model call. Everything it returns is stored as an ordinary task with
 * origin 'ai_proposed', which is the point: the student then accepts, edits,
 * reorders or deletes them, and which of those they do is itself evidence
 * about how they turn an ambiguous problem into executable work.
 *
 * Nothing is auto-started. Tasks land in Backlog, unassigned unless a
 * teammate holds the matching work role, and the board looks exactly as it
 * would if a person had typed them.
 *
 * Rate limited three ways, which is not belt and braces. The workspace limit
 * catches a loop; the generic agent limit is the app-wide ceiling on paid
 * calls; and checkAgentRateLimit counts actual rows in agent_calls, which is
 * the only one that FAILS CLOSED — a limiter that stops limiting when the
 * database hiccups is not a limiter, and this endpoint spends money.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  if (!agentsAvailable()) {
    return NextResponse.json(
      { error: 'Planning is unavailable right now. You can still add tasks yourself.' },
      { status: 503 },
    )
  }

  const workspaceLimited = await enforce('workspace', user.id)
  if (workspaceLimited) return workspaceLimited
  const agentLimited = await enforce('agent', user.id)
  if (agentLimited) return agentLimited

  let workspaceId: string
  try {
    workspaceId = requireUuid((await params).id, 'Project')
  } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
    throw err
  }

  // Read through the caller's own session: a project they are not on comes
  // back empty, and there is nothing to tell them about it.
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, title, summary, deadline, status')
    .eq('id', workspaceId)
    .maybeSingle()

  if (!workspace) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
  if (workspace.status === 'draft') {
    return NextResponse.json(
      { error: 'Start the project first — link a repository and the plan will have somewhere to land.' },
      { status: 400 },
    )
  }

  const [{ data: memberRows }, { data: existing }] = await Promise.all([
    supabase
      .from('workspace_members')
      .select('account_id, role, work_role, accepted_at, removed_at')
      .eq('workspace_id', workspaceId)
      .is('removed_at', null),
    supabase.from('tasks').select('title, position').eq('workspace_id', workspaceId),
  ])

  const members = (memberRows ?? []) as MemberRow[]
  const active = members.filter((m) => m.accepted_at !== null)
  const teamRoles = Array.from(
    new Set(active.map((m) => m.work_role).filter((r): r is WorkRole => !!r)),
  )

  // The agent audit table is read under the service role: it is the durable
  // record of what has been spent, and RLS deliberately keeps it away from
  // the person doing the spending.
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const agentLimit = await checkAgentRateLimit(admin, 'planner', user.id, 'student_id')
  if (!agentLimit.allowed) {
    return NextResponse.json({ error: agentLimit.message }, { status: 429 })
  }

  const plan = await planProject(admin, user.id, {
    title: workspace.title as string,
    summary: workspace.summary as string | null,
    teamRoles,
    teamSize: active.length,
    deadline: workspace.deadline as string | null,
    // Sent so a second run tops the board up instead of proposing the same
    // eight tasks again.
    existingTitles: (existing ?? []).map((t) => t.title as string).slice(0, 60),
  })

  if (!plan) {
    return NextResponse.json(
      { error: 'Could not draft a plan just now. Try again, or add tasks yourself.' },
      { status: 502 },
    )
  }

  // Appended below whatever is already there, in the order proposed. The
  // order is the plan's argument about sequence — schema before the
  // endpoints that read it — so it must survive into the board.
  const highest = (existing ?? []).reduce(
    (max, t) => Math.max(max, Number(t.position) || 0),
    0,
  )

  const rows = plan.tasks.map((task, index) => ({
    workspace_id: workspaceId,
    title: task.title,
    detail: task.detail || null,
    acceptance_criteria: task.acceptanceCriteria || null,
    suggested_role: task.suggestedRole,
    // Unassigned when nobody holds the role. Better than landing on
    // whoever happens to be listed first, which is how a teammate ends up
    // owning work they never agreed to.
    assignee_id: assigneeForRole(active, task.suggestedRole),
    estimate_hours: task.estimateHours,
    difficulty: task.difficulty,
    verifiable: task.verifiable,
    origin: 'ai_proposed',
    plan_call_id: plan.callId,
    position: highest + POSITION_STEP * (index + 1),
    created_by: user.id,
  }))

  const { error } = await supabase.from('tasks').insert(rows)
  if (error) {
    console.error('[api/workspaces/:id/plan] insert failed:', error)
    return NextResponse.json({ error: 'Drafted the plan but could not save it.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, count: rows.length })
}
