import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enforce } from '@/lib/rate-limit'
import { parseBody, readFields, optionalString, requireUuid, ValidationError } from '@/lib/http/validate'
import { answerRefusal } from '@/lib/workspace/checkpoints'

/**
 * PATCH /api/workspaces/[id]/checkpoints/[checkpointId] — answer, or skip.
 *
 * Skipping is a first-class outcome, not a failure to answer. A checkpoint
 * somebody cannot dismiss is one they lie to, and a made-up approach is worse
 * than no approach: the verifier would hold the diff against a prediction
 * nobody meant.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; checkpointId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const limited = await enforce('workspace', user.id)
  if (limited) return limited

  let workspaceId: string, checkpointId: string
  try {
    const raw = await params
    workspaceId = requireUuid(raw.id, 'Project')
    checkpointId = requireUuid(raw.checkpointId, 'Checkpoint')
  } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
    throw err
  }

  const parsed = await parseBody(request)
  if (!parsed.ok) return parsed.response
  const fields = readFields(() => ({
    answer: optionalString(parsed.body.answer, 'Answer', { max: 2000 }),
  }))
  if (!fields.ok) return fields.response

  const { data: checkpoint } = await supabase
    .from('task_checkpoints')
    .select('id, account_id, answered_at, skipped_at')
    .eq('id', checkpointId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (!checkpoint) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  // Theirs alone. A teammate answering "what will you try first" on somebody
  // else's card would put words in their mouth, and the verifier reads this
  // as a prediction the assignee made.
  if (checkpoint.account_id !== user.id) {
    return NextResponse.json({ error: 'This one is not yours to answer.' }, { status: 403 })
  }
  if (checkpoint.answered_at || checkpoint.skipped_at) {
    return NextResponse.json({ error: 'That has already been answered.' }, { status: 400 })
  }

  const answer = fields.values.answer
  const now = new Date().toISOString()

  // No answer means skip. Recorded rather than deleted, because "they were
  // asked and chose not to say" is itself worth knowing when a dispute asks
  // what the record rests on.
  const patch = answer === null || answer.trim() === ''
    ? { skipped_at: now }
    : { answer: answer.trim(), answered_at: now }

  if ('answer' in patch) {
    const refusal = answerRefusal(answer!)
    if (refusal) return NextResponse.json({ error: refusal }, { status: 400 })
  }

  const { error } = await supabase.from('task_checkpoints').update(patch).eq('id', checkpointId)
  if (error) {
    console.error('[api/checkpoints/:id] could not save:', error)
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, skipped: 'skipped_at' in patch })
}
