import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { enforce } from '@/lib/rate-limit'
import { agentsAvailable } from '@/lib/agents/client'
import { checkAgentRateLimit } from '@/lib/agents/rate-limit'
import { runVerification } from '@/lib/workspace/run-verification'
import { requireUuid, ValidationError } from '@/lib/http/validate'

/**
 * POST /api/workspaces/[id]/verify — check everything submitted.
 *
 * A batch, not a task. Ten tasks submitted in a day share a repository, a
 * project and a team, so asking about all of them in one call costs roughly
 * what two separate calls would. Submitting a task therefore queues it; it
 * does not trigger anything.
 *
 * The run is created here and executed here, but the row is the queue: if
 * this request dies partway the run stays claimable and the nightly sweep
 * finishes it. That is why the claim is a single UPDATE rather than a read
 * followed by a write — see claim_verification_run in v05_0032.
 *
 * The caller only ever creates the run. Every verdict is written under the
 * service role inside runVerification, because a student who could write a
 * verdict could put unearned evidence on their own record.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  if (!agentsAvailable()) {
    return NextResponse.json(
      { error: 'Checking is unavailable right now. A teammate can confirm the work instead.' },
      { status: 503 },
    )
  }

  const limited = await enforce('workspace', user.id)
  if (limited) return limited
  const agentLimited = await enforce('agent', user.id)
  if (agentLimited) return agentLimited

  let workspaceId: string
  try {
    workspaceId = requireUuid((await params).id, 'Project')
  } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
    throw err
  }

  // Through the caller's own session, so a project they are not on simply
  // has nothing to check.
  const { count } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'submitted')

  if ((count ?? 0) === 0) {
    return NextResponse.json(
      { error: 'Nothing is waiting to be checked. Move a task to Submitted first.' },
      { status: 400 },
    )
  }

  // Insert under the caller's session on purpose: the policy pins
  // triggered_by to them and the status to queued, so this is the one part
  // of verification a student is allowed to write.
  const { data: run, error } = await supabase
    .from('verification_runs')
    .insert({ workspace_id: workspaceId, triggered_by: user.id, trigger: 'manual', status: 'queued' })
    .select('id')
    .single()

  if (error || !run) {
    if (error?.code === '42501') {
      return NextResponse.json({ error: 'You are not on this project.' }, { status: 403 })
    }
    console.error('[api/verify] could not queue run:', error)
    return NextResponse.json({ error: 'Could not start a check.' }, { status: 500 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Counted after the run exists, so a refusal here still leaves a queued
  // row the sweep will pick up tomorrow rather than losing the request.
  const agentLimit = await checkAgentRateLimit(admin, 'verification', user.id, 'student_id')
  if (!agentLimit.allowed) {
    return NextResponse.json({ error: agentLimit.message, runId: run.id }, { status: 429 })
  }

  const outcome = await runVerification(admin, run.id as string)

  if (!outcome) {
    // Claimed by something else, or it failed. Either way the row carries
    // the truth and the student is not told a verdict that does not exist.
    return NextResponse.json({
      ok: true,
      queued: true,
      message: 'The check is running. Refresh in a moment.',
    })
  }

  return NextResponse.json({ ok: true, ...outcome })
}
