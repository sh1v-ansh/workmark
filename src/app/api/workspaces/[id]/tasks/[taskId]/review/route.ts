import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { enforce } from '@/lib/rate-limit'
import { workspaceAcceptsWork, type MemberRow } from '@/lib/workspace/membership'
import {
  canReview, outcomeFor, HUMAN_VERDICTS,
  type HumanVerdict, type ReviewableTask,
} from '@/lib/workspace/review'
import {
  parseBody, readFields, requireOneOf, optionalString, requireUuid, ValidationError,
} from '@/lib/http/validate'

interface Params { params: Promise<{ id: string; taskId: string }> }

/**
 * POST /api/workspaces/[id]/tasks/[taskId]/review — a person's answer.
 *
 * The escape hatch the automatic checker depends on. Two attempts, then a
 * task goes to a teammate; work marked as having no code goes straight to
 * one. Without this route those cards never move again.
 *
 * Authorization is read through the caller's own session, so a project they
 * are not on has no task to find. The answer is written under the service
 * role, for the same reason every other verdict is: a student who could write
 * `human_verified` could put unearned evidence on their own record. The rule
 * that stops that is in canReview — whoever did the work never confirms it.
 */
export async function POST(request: Request, { params }: Params) {
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
    verdict: requireOneOf(parsed.body.verdict, 'An answer', HUMAN_VERDICTS),
    note: optionalString(parsed.body.note, 'Your note', { max: 2000 }),
  }))
  if (!fields.ok) return fields.response
  const { verdict, note } = fields.values as { verdict: HumanVerdict; note: string | null }

  const [{ data: task }, { data: memberRows }] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, status, assignee_id, title')
      .eq('id', taskId)
      .eq('workspace_id', workspaceId)
      .maybeSingle(),
    supabase
      .from('workspace_members')
      .select('account_id, role, work_role, accepted_at, removed_at')
      .eq('workspace_id', workspaceId),
  ])

  if (!task) return NextResponse.json({ error: 'Task not found.' }, { status: 404 })

  // Once a project is closed its evidence is already written, so an answer
  // here would change nothing except the board. Refused rather than accepted
  // and quietly ignored.
  const { data: workspaceRow } = await supabase
    .from('workspaces')
    .select('status')
    .eq('id', workspaceId)
    .maybeSingle()

  const shut = workspaceRow ? workspaceAcceptsWork(workspaceRow.status as string) : null
  if (shut) return NextResponse.json({ error: shut }, { status: 400 })

  // The submission being answered is the most recent one. An older attempt
  // already has its answer, and writing to it would put a verdict on a
  // question nobody is asking any more.
  const { data: submission } = await supabase
    .from('task_submissions')
    .select('id, verdict, human_verdict, notes')
    .eq('task_id', taskId)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const reviewable: ReviewableTask = {
    id: task.id as string,
    status: task.status as string,
    assigneeId: task.assignee_id as string | null,
    latestVerdict: (submission?.verdict as string | null) ?? null,
    humanVerdict: (submission?.human_verdict as string | null) ?? null,
  }

  const refusal = canReview((memberRows ?? []) as unknown as MemberRow[], user.id, reviewable)
  if (refusal) return NextResponse.json({ error: refusal }, { status: 403 })

  const outcome = outcomeFor(verdict)

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { error: submissionError } = await admin
    .from('task_submissions')
    .update({
      // Left null when the reviewer could not tell, so the next person is not
      // locked out of a question nobody has actually answered.
      ...(outcome.recordsAnswer ? { human_verdict: verdict, human_actor_id: user.id } : {}),
      verdict: outcome.submissionVerdict,
      // Appended rather than replacing: the checker's reasoning is why this
      // reached a person at all, and dropping it would leave the student with
      // an answer and no account of how it was reached.
      ...(note || !outcome.recordsAnswer
        ? {
          notes: appendNote(
            (submission?.notes as string | null) ?? null,
            note ?? 'Looked at this and could not say either way.',
          ),
        }
        : {}),
      decided_at: new Date().toISOString(),
    })
    .eq('id', submission!.id)

  if (submissionError) {
    console.error('[api/tasks/:id/review] could not record the answer:', submissionError)
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
  }

  if (outcome.taskStatus) {
    const { error: taskError } = await admin
      .from('tasks')
      .update({ status: outcome.taskStatus })
      .eq('id', taskId)
      .eq('workspace_id', workspaceId)
    if (taskError) {
      // The answer is recorded and the card is not. Worth saying, because the
      // board will look wrong until somebody moves it.
      console.error('[api/tasks/:id/review] answer saved but the card did not move:', taskError)
      return NextResponse.json(
        { error: 'Your answer was saved but the card did not move. Refresh and try again.' },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({ ok: true, verdict, message: outcome.message })
}

/** Kept separate so the shape of a reviewer's note has one definition. */
function appendNote(existing: string | null, note: string): string {
  return existing ? `${existing}\n\nReviewer: ${note}` : `Reviewer: ${note}`
}
