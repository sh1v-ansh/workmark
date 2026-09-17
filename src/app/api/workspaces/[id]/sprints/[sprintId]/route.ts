import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { enforce } from '@/lib/rate-limit'
import { requireUuid, ValidationError } from '@/lib/http/validate'
import { checkAgentRateLimit } from '@/lib/agents/rate-limit'
import { reviewSprint } from '@/lib/agents/retro'
import { canClose, retroBrief, toSprint, type SprintTask } from '@/lib/workspace/sprint'
import { loadProjectState } from '@/lib/workspace/project-state'

/**
 * POST /api/workspaces/[id]/sprints/[sprintId] — end the week and review it.
 *
 * Two things happen, and only one of them is allowed to fail.
 *
 * Closing is the load-bearing half: it is what lets the next week start, and
 * it is a single write nobody should be blocked on. The retro is the valuable
 * half and it is a model call, which can be unavailable, rate limited or
 * refused. So the sprint closes first and the review is attached if it
 * arrives. A sprint that would not close because a model call failed is a
 * board somebody cannot move past, which is a far worse failure than a sprint
 * with no retro on it.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string; sprintId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const limited = await enforce('workspace', user.id)
  if (limited) return limited

  let workspaceId: string, sprintId: string
  try {
    const raw = await params
    workspaceId = requireUuid(raw.id, 'Project')
    sprintId = requireUuid(raw.sprintId, 'Sprint')
  } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
    throw err
  }

  const { data: row } = await supabase
    .from('sprints')
    .select('id, name, goal, starts_on, ends_on, closed_at, retro')
    .eq('id', sprintId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (!row) return NextResponse.json({ error: 'Week not found.' }, { status: 404 })

  const sprint = toSprint(row)
  const refusal = canClose(sprint)
  if (refusal) return NextResponse.json({ error: refusal }, { status: 400 })

  // Closed before the model is asked anything. Everything after this point is
  // an improvement to a week that has already ended.
  const { error: closeError } = await supabase
    .from('sprints')
    .update({ closed_at: new Date().toISOString() })
    .eq('id', sprintId)
    .is('closed_at', null)

  if (closeError) {
    console.error('[api/workspaces/:id/sprints/:sprintId] could not close:', closeError)
    return NextResponse.json({ error: 'Could not end the week.' }, { status: 500 })
  }

  const state = await loadProjectState(supabase, workspaceId)
  if (!state) return NextResponse.json({ ok: true, closed: true, retro: null })

  const { data: taskRows } = await supabase
    .from('tasks')
    .select('id, title, status, sprint_id, estimate_hours, difficulty')
    .eq('workspace_id', workspaceId)

  const tasks: SprintTask[] = (taskRows ?? []).map((t) => ({
    id: t.id as string,
    title: t.title as string,
    status: t.status as SprintTask['status'],
    sprintId: (t.sprint_id as string | null) ?? null,
    estimateHours: t.estimate_hours === null ? null : Number(t.estimate_hours),
    difficulty: t.difficulty as number | null,
  }))

  // The reasons are what make a retro worth a model call rather than a
  // printout: an estimate that moved with an explanation given at the time is
  // a different week from one that moved silently.
  const inSprint = new Set(tasks.filter((t) => t.sprintId === sprintId).map((t) => t.id))
  const titleOf = new Map(tasks.map((t) => [t.id, t.title]))
  const slipped = state.revisions
    .filter((r) => inSprint.has(r.taskId) && (r.field === 'estimate_hours' || r.field === 'due_on'))
    .map((r) => ({ title: titleOf.get(r.taskId) ?? 'A task', reason: r.reason }))

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const agentLimit = await checkAgentRateLimit(admin, 'retro', user.id, 'student_id')
  if (!agentLimit.allowed) {
    return NextResponse.json({ ok: true, closed: true, retro: null, note: agentLimit.message })
  }

  // Built from the task rows directly rather than by filtering setbacks() on
  // title: two cards on one board can share a title, and matching on it would
  // pull another week's failure into this week's review.
  const trouble = state.tasks
    .filter((t) => inSprint.has(t.id))
    .filter((t) => t.latestVerdict === 'needs_work' || t.status === 'abandoned')
    .map((t) => ({
      title: t.title,
      note: t.status === 'abandoned' ? t.abandonedReason : t.verdictNote,
    }))

  const facts = retroBrief(sprint, tasks, { slipped, setbacks: trouble })

  const reviewed = await reviewSprint(admin, user.id, facts)
  if (!reviewed) {
    return NextResponse.json({ ok: true, closed: true, retro: null })
  }

  const text = `${reviewed.value.summary}\n\n${reviewed.value.suggestion}`
  const { error: retroError } = await admin
    .from('sprints')
    .update({ retro: text, retro_call_id: reviewed.callId })
    .eq('id', sprintId)

  if (retroError) {
    // The week is closed and the review is written; only storing it failed.
    // Returned anyway so the student reads it once rather than not at all.
    console.error('[api/workspaces/:id/sprints/:sprintId] could not store the retro:', retroError)
  }

  return NextResponse.json({ ok: true, closed: true, retro: text })
}
