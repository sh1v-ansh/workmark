import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { enforce } from '@/lib/rate-limit'
import { requireUuid, ValidationError } from '@/lib/http/validate'
import { checkAgentRateLimit } from '@/lib/agents/rate-limit'
import { checkScope } from '@/lib/agents/kickoff'
import { kickoffBrief, toSprint, type SprintTask } from '@/lib/workspace/sprint'
import { loadMetrics } from '@/lib/workspace/queries'

/**
 * POST /api/workspaces/[id]/sprints/[sprintId]/check — is this week doable?
 *
 * The half of a project manager's job a retro cannot do: saying "that is
 * three weeks of work" before the week rather than after it.
 *
 * Nothing is written. A scope check is advice and the student is free to
 * ignore it, which is why it is a button they press rather than something
 * that happens to them when they drag a card.
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
  if (sprint.closedAt) {
    return NextResponse.json({ error: 'That week is already over.' }, { status: 400 })
  }

  const { data: taskRows } = await supabase
    .from('tasks')
    .select('id, title, status, sprint_id, estimate_hours, difficulty')
    .eq('workspace_id', workspaceId)
    .eq('sprint_id', sprintId)

  const tasks: SprintTask[] = (taskRows ?? []).map((t) => ({
    id: t.id as string,
    title: t.title as string,
    status: t.status as SprintTask['status'],
    sprintId: (t.sprint_id as string | null) ?? null,
    estimateHours: t.estimate_hours === null ? null : Number(t.estimate_hours),
    difficulty: t.difficulty as number | null,
  }))

  // Refused before the money is spent. There is nothing to pressure-test
  // about an empty week, and the honest answer costs nothing.
  if (tasks.length === 0) {
    return NextResponse.json(
      { error: 'Put some tasks in this week first — there is nothing to check yet.' },
      { status: 409 },
    )
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const agentLimit = await checkAgentRateLimit(admin, 'kickoff', user.id, 'student_id')
  if (!agentLimit.allowed) {
    return NextResponse.json({ error: agentLimit.message }, { status: 429 })
  }

  // Their own estimate history, which is the one thing here they could not
  // work out for themselves.
  const measured = await loadMetrics(supabase, workspaceId, user.id)
  const estimation = measured?.metrics.estimation

  const facts = kickoffBrief(sprint, tasks, {
    bias: estimation?.bias.value ?? null,
    spread: estimation?.spread.value ?? null,
    sample: estimation?.bias.sample ?? 0,
  })

  const result = await checkScope(admin, user.id, facts)
  if (!result) {
    return NextResponse.json(
      { error: 'Could not check this week just now. Nothing has changed.' },
      { status: 502 },
    )
  }

  return NextResponse.json({ ok: true, ...result })
}
