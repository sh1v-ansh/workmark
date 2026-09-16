import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { enforce } from '@/lib/rate-limit'
import {
  parseBody, readFields, requireString, requireUuid, ValidationError,
} from '@/lib/http/validate'
import { checkAgentRateLimit } from '@/lib/agents/rate-limit'
import { answerOnTask } from '@/lib/agents/helper'
import {
  shouldAnswer, stripMention, threadForAgent, type Message,
} from '@/lib/workspace/messages'

/**
 * POST /api/workspaces/[id]/tasks/[taskId]/messages — say something.
 *
 * The message is always written. Whether Workmark answers is a second,
 * separate question, and the order matters: a model call that fails must not
 * lose what somebody typed.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const limited = await enforce('workspace', user.id)
  if (limited) return limited

  let workspaceId: string, taskId: string
  try {
    const raw = await params
    workspaceId = requireUuid(raw.id, 'Project')
    taskId = requireUuid(raw.taskId, 'Task')
  } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
    throw err
  }

  const parsed = await parseBody(request)
  if (!parsed.ok) return parsed.response
  const fields = readFields(() => ({
    body: requireString(parsed.body.body, 'Message', { min: 1, max: 4000 }),
  }))
  if (!fields.ok) return fields.response

  // Read through the caller's session: RLS decides whether they are on this
  // project, and a task they cannot see simply is not found.
  const { data: task } = await supabase
    .from('tasks')
    .select('id, title, acceptance_criteria')
    .eq('id', taskId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (!task) return NextResponse.json({ error: 'Task not found.' }, { status: 404 })

  const { data: written, error } = await supabase
    .from('workspace_messages')
    .insert({
      workspace_id: workspaceId,
      task_id: taskId,
      sender_id: user.id,
      sender_kind: 'member',
      body: fields.values.body,
    })
    .select('id, task_id, sender_id, sender_kind, body, created_at')
    .single()

  if (error || !written) {
    console.error('[api/tasks/:id/messages] could not post:', error)
    return NextResponse.json({ error: 'Could not send that.' }, { status: 500 })
  }

  // ── Does Workmark answer? ──
  const { data: priorRows } = await supabase
    .from('workspace_messages')
    .select('id, task_id, sender_id, sender_kind, body, created_at')
    .eq('task_id', taskId)
    .order('created_at')
    .limit(60)

  const messages: Message[] = (priorRows ?? []).map((m) => ({
    id: m.id as string,
    taskId: (m.task_id as string | null) ?? null,
    senderId: (m.sender_id as string | null) ?? null,
    senderKind: (m.sender_kind as 'member' | 'agent') ?? 'member',
    body: m.body as string,
    createdAt: (m.created_at as string | null) ?? null,
  }))

  // The thread as it stood before this message, so the agent is not handed
  // the question twice.
  const before = { messages: messages.filter((m) => m.id !== written.id) }
  const refusal = shouldAnswer(fields.values.body, before)

  // Nobody asked. The message stands on its own and nothing is spent.
  if (refusal === 'not-mentioned') {
    return NextResponse.json({ ok: true, message: written, reply: null })
  }
  // Asked, but not answerable — said out loud rather than swallowed, because
  // silence after a mention reads as the feature being broken.
  if (refusal) {
    return NextResponse.json({ ok: true, message: written, reply: null, note: refusal })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const agentLimit = await checkAgentRateLimit(admin, 'helper', user.id, 'student_id')
  if (!agentLimit.allowed) {
    return NextResponse.json({ ok: true, message: written, reply: null, note: agentLimit.message })
  }

  const [{ data: workspace }, { data: submission }] = await Promise.all([
    supabase.from('workspaces').select('title').eq('id', workspaceId).maybeSingle(),
    supabase
      .from('task_submissions')
      .select('notes')
      .eq('task_id', taskId)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const reply = await answerOnTask(admin, user.id, {
    projectTitle: (workspace?.title as string | null) ?? 'this project',
    taskTitle: task.title as string,
    acceptanceCriteria: (task.acceptance_criteria as string | null) ?? null,
    checkerNote: (submission?.notes as string | null) ?? null,
    thread: threadForAgent(before),
    question: stripMention(fields.values.body),
  })

  if (!reply) {
    return NextResponse.json({
      ok: true, message: written, reply: null,
      note: 'Workmark could not answer just now. Your message was posted.',
    })
  }

  // Service role: workspace_messages has no insert policy for an agent, and
  // the check constraint requires sender_id to be null when sender_kind is
  // 'agent' — an agent has no account and must not claim one.
  const { data: agentMessage } = await admin
    .from('workspace_messages')
    .insert({
      workspace_id: workspaceId,
      task_id: taskId,
      sender_id: null,
      sender_kind: 'agent',
      body: reply.body,
    })
    .select('id, task_id, sender_id, sender_kind, body, created_at')
    .single()

  // Offered, never applied. The student presses the button — the same
  // decision they would make for themselves on a real job.
  return NextResponse.json({
    ok: true,
    message: written,
    reply: agentMessage ?? null,
    suggestedSubtask: reply.suggestedSubtask ?? null,
  })
}
