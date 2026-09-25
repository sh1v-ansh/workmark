import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { enforce } from '@/lib/rate-limit'
import { agentsAvailable } from '@/lib/agents/client'
import { checkAgentRateLimit } from '@/lib/agents/rate-limit'
import { planProject } from '@/lib/agents/planner'
import { assigneeForRole, type MemberRow, type WorkRole } from '@/lib/workspace/membership'
import { POSITION_STEP } from '@/lib/workspace/tasks'
import { releaseTickets, RAMP_UP_TICKET } from '@/lib/workspace/queue'
import { requireUuid, ValidationError } from '@/lib/http/validate'
import { loadProjectState, canAskForMore, progressBrief } from '@/lib/workspace/project-state'
import { textStreamResponse } from '@/lib/http/text-stream'
import { localNow, releaseDailyBatch, validTimezone } from '@/lib/workspace/daily'

export const maxDuration = 60

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
 * Streamed: each task is sent as one JSON line the moment the model
 * finishes writing it, so the cards appear one by one. Nothing is saved
 * until the whole plan is in; the closing record says how it went.
 *
 * Rate limited three ways, which is not belt and braces. The workspace limit
 * catches a loop; the generic agent limit is the app-wide ceiling on paid
 * calls; and checkAgentRateLimit counts actual rows in agent_calls, which is
 * the only one that FAILS CLOSED — a limiter that stops limiting when the
 * database hiccups is not a limiter, and this endpoint spends money.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // A backstop, not a substitute for handling errors where they happen. Next
  // turns an uncaught throw into an HTML 500, which the client cannot parse
  // out of `res.json()` — so the browser falls back to a generic sentence and
  // the real cause reaches nobody. Everything below returns JSON; this makes
  // sure the unexpected does too.
  try {
    return await draftPlan(request, params)
  } catch (err) {
    console.error('[api/workspaces/:id/plan] unhandled:', err)
    return NextResponse.json(
      { error: 'Something went wrong drafting the plan. Nothing was saved.' },
      { status: 500 },
    )
  }
}

async function draftPlan(request: Request, params: Promise<{ id: string }>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  if (!agentsAvailable()) {
    return NextResponse.json(
      { error: 'Planning is unavailable right now. You can still add tasks yourself.' },
      { status: 503 },
    )
  }

  // How tasks should arrive, chosen alongside the first draft. Optional on
  // a top-up, where the project already has a pace.
  const body = (await request.json().catch(() => null)) as { pace?: unknown; timezone?: unknown } | null
  const chosenPace = body?.pace === 'daily' || body?.pace === 'all_at_once' ? body.pace : null
  const chosenTimezone = validTimezone(body?.timezone)

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
    .select('id, title, summary, deadline, status, pace, timezone')
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

  // What has happened so far, read rather than rescanned — the verifier has
  // already decided what is finished, and re-deriving it from the same
  // commits is how a planner ends up disagreeing with a verdict the student
  // was shown. See project-state.ts.
  const state = await loadProjectState(supabase, workspaceId)

  // Refused before the money is spent, not after. A student with four cards
  // waiting to be checked does not need a bigger board, and generating more
  // would turn their completion figures into noise.
  if (state) {
    const refusal = canAskForMore(state)
    if (refusal) return NextResponse.json({ error: refusal }, { status: 409 })
  }

  return textStreamResponse(async (emit) => {
    const plan = await planProject(admin, user.id, {
      title: workspace.title as string,
      summary: workspace.summary as string | null,
      teamRoles,
      teamSize: active.length,
      deadline: workspace.deadline as string | null,
      // Sent so a second run tops the board up instead of proposing the same
      // eight tasks again.
      existingTitles: (existing ?? []).map((t) => t.title as string).slice(0, 60),
      // Omitted on a board with no history, where it would be a paragraph
      // saying nothing had happened yet.
      progress: state && state.tasks.length > 0 ? progressBrief(state) : null,
    }, (task) => emit(JSON.stringify({ title: task.title, estimateHours: task.estimateHours }) + '\n'))

    if (!plan) {
      return { error: 'Could not draft a plan just now. Try again, or add tasks yourself.' }
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
      before_question: task.beforeQuestion,
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

    // Ids come back in insert order, which is what makes the planner's
    // dependsOn indices resolvable. Without the select this is a fire-and-forget
    // insert and the dependency graph the model just worked out is thrown away.
    const { data: inserted, error } = await supabase.from('tasks').insert(rows).select('id')
    if (error) {
      console.error('[api/workspaces/:id/plan] insert failed:', error)
      return { error: 'Drafted the plan but could not save it.' }
    }

    const dependencies = await recordDependencies(supabase, workspaceId, plan.tasks, inserted ?? [])

    // A first plan on an empty board opens with the day-one ticket. Its own
    // insert, so the planner's dependsOn indices above still line up, and
    // position 0 so it sits above everything the plan proposed.
    if ((existing ?? []).length === 0) {
      const { error: rampErr } = await supabase.from('tasks').insert({
        workspace_id: workspaceId,
        title: RAMP_UP_TICKET.title,
        detail: RAMP_UP_TICKET.detail,
        acceptance_criteria: RAMP_UP_TICKET.acceptanceCriteria,
        estimate_hours: RAMP_UP_TICKET.estimateHours,
        difficulty: RAMP_UP_TICKET.difficulty,
        verifiable: true,
        ticket_kind: 'ramp_up',
        origin: 'ai_proposed',
        assignee_id: assigneeForRole(active, null),
        position: 0,
        created_by: user.id,
      })
      if (rampErr) console.error('[api/workspaces/:id/plan] ramp-up insert failed:', rampErr)
    }

    // Save the pace first: releaseTickets reads it.
    const pace = chosenPace ?? (workspace.pace as string | null) ?? 'all_at_once'
    const timezone = chosenTimezone ?? (workspace.timezone as string | null)
    if (chosenPace || chosenTimezone) {
      const { error: paceErr } = await admin.from('workspaces')
        .update({ pace, ...(timezone ? { timezone } : {}) }).eq('id', workspaceId)
      if (paceErr) console.error('[api/workspaces/:id/plan] pace save failed:', paceErr)
    }

    // Everything just landed in the backlog. On a daily pace the first
    // day's batch goes out now, the rest at 8:00 each morning; otherwise the
    // queue decides what arrives in Planned. Best-effort — a failure leaves
    // the plan in the backlog, where it can still be dragged out by hand.
    let released = 0
    try {
      released = pace === 'daily'
        ? (await releaseDailyBatch(admin, workspaceId, localNow(timezone).date)).length
        : (await releaseTickets(admin, workspaceId)).length
    } catch (err) {
      console.error('[api/workspaces/:id/plan] release failed:', err)
    }

    return { ok: true, count: rows.length, dependencies, released, pace }
  })
}

/**
 * DELETE /api/workspaces/[id]/plan — remove the drafted plan.
 *
 * Deletes the AI-drafted tasks nobody has started: still in the backlog or
 * Planned, with no submission. Anything in progress, submitted or finished
 * stays, because it is work somebody did. The pace resets so the next draft
 * asks again.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  const limited = await enforce('workspace', user.id)
  if (limited) return limited

  let workspaceId: string
  try {
    workspaceId = requireUuid((await params).id, 'Project')
  } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
    throw err
  }

  const { data: me } = await supabase.from('workspace_members').select('role')
    .eq('workspace_id', workspaceId).eq('account_id', user.id).is('removed_at', null).maybeSingle()
  if (me?.role !== 'owner') return NextResponse.json({ error: 'Only the project owner can remove the plan.' }, { status: 403 })

  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: candidates } = await admin
    .from('tasks')
    .select('id')
    .eq('workspace_id', workspaceId)
    .in('origin', ['ai_proposed', 'ai_edited'])
    .in('status', ['backlog', 'planned'])
  const ids = (candidates ?? []).map((t) => t.id as string)
  if (ids.length === 0) return NextResponse.json({ ok: true, removed: 0 })

  // Never a task with a submission against it, whatever its status says.
  const { data: submitted } = await admin.from('task_submissions').select('task_id').in('task_id', ids)
  const keep = new Set((submitted ?? []).map((s) => s.task_id as string))
  const remove = ids.filter((id) => !keep.has(id))

  if (remove.length > 0) {
    // Subtasks of removed tasks go with them.
    await admin.from('tasks').delete().in('parent_task_id', remove)
    const { error } = await admin.from('tasks').delete().in('id', remove)
    if (error) {
      console.error('[api/workspaces/:id/plan] remove failed:', error)
      return NextResponse.json({ error: 'Could not remove the plan.' }, { status: 500 })
    }
  }
  await admin.from('workspaces').update({ pace: null, last_batch_on: null }).eq('id', workspaceId)
  return NextResponse.json({ ok: true, removed: remove.length })
}

/**
 * Write down what the planner said has to happen first.
 *
 * Recorded, not enforced. Nothing stops somebody starting a task whose
 * dependency is unfinished, and that is on purpose twice over: a board that
 * refuses moves is a board people work around, and "declared a dependency,
 * then hit a different one anyway" is a more interesting fact about how
 * somebody plans than a graph that was obeyed because it had to be.
 *
 * The comparison this makes possible — dependencies declared up front versus
 * dependencies discovered halfway through — is one of the clearer signals in
 * the product about whether somebody can see the shape of a problem before
 * starting it.
 *
 * Best-effort: the plan is saved either way. Losing the edges costs a metric;
 * failing the request would cost the student their whole plan.
 */
async function recordDependencies(
  supabase: SupabaseClient,
  workspaceId: string,
  planned: { dependsOn: number[] }[],
  inserted: { id: string }[],
): Promise<number> {
  if (inserted.length !== planned.length) return 0

  const edges: { workspace_id: string; task_id: string; depends_on_id: string }[] = []
  planned.forEach((task, index) => {
    for (const dependency of task.dependsOn) {
      // An index the model invented, or one pointing at itself. Both are
      // normal enough from a language model that neither is worth an error;
      // the edge is simply not written.
      if (dependency === index || dependency >= inserted.length) continue
      edges.push({
        workspace_id: workspaceId,
        task_id: inserted[index].id,
        depends_on_id: inserted[dependency].id,
      })
    }
  })

  if (edges.length === 0) return 0

  const { error } = await supabase.from('task_dependencies').insert(edges)
  if (error) {
    console.error('[api/workspaces/:id/plan] dependencies not saved:', error)
    return 0
  }
  return edges.length
}
