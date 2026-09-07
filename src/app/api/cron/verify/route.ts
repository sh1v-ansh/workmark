import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { runVerification } from '@/lib/workspace/run-verification'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * POST /api/cron/verify — finish what is waiting.
 *
 * Two jobs, and the second is the one that matters.
 *
 * It picks up runs a student queued whose request died partway — a closed
 * tab, a cold start, a platform timeout. Without this, a submission whose
 * check was interrupted sits in Submitted forever with nothing coming.
 *
 * And it queues a nightly run for any project with work waiting that nobody
 * asked about. A student who submits three tasks on Friday and does not
 * press the button should not come back on Monday to three cards still
 * saying "waiting to be checked".
 *
 * Bounded per invocation. A sweep that tries to clear an unbounded backlog
 * inside one function is a sweep that times out and clears none of it.
 */
const MAX_RUNS_PER_SWEEP = 20

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // ── Queue a run for anything submitted that nobody has asked about ──
  //
  // A project only gets one. verification_runs_claimable_idx makes the
  // "already waiting" check cheap, and skipping projects that already have a
  // queued run is what stops the sweep enqueuing a second every night.
  const { data: waiting } = await admin
    .from('tasks')
    .select('workspace_id')
    .eq('status', 'submitted')

  const workspaceIds = Array.from(new Set((waiting ?? []).map((t) => t.workspace_id as string)))

  if (workspaceIds.length > 0) {
    const { data: alreadyQueued } = await admin
      .from('verification_runs')
      .select('workspace_id')
      .in('workspace_id', workspaceIds)
      .in('status', ['queued', 'running'])

    const pending = new Set((alreadyQueued ?? []).map((r) => r.workspace_id as string))
    const toQueue = workspaceIds.filter((id) => !pending.has(id)).slice(0, MAX_RUNS_PER_SWEEP)

    if (toQueue.length > 0) {
      const { error } = await admin.from('verification_runs').insert(
        toQueue.map((workspace_id) => ({
          workspace_id,
          // Null triggered_by is what 'scheduled' means: nobody asked.
          triggered_by: null,
          trigger: 'scheduled' as const,
          status: 'queued' as const,
        })),
      )
      if (error) console.error('[cron/verify] could not queue runs:', error)
    }
  }

  // ── Run whatever is claimable, oldest first ──
  const { data: claimable } = await admin
    .from('verification_runs')
    .select('id')
    .in('status', ['queued', 'running'])
    .order('queued_at')
    .limit(MAX_RUNS_PER_SWEEP)

  let completed = 0
  let skipped = 0

  for (const run of claimable ?? []) {
    // Null means somebody else holds it, or it failed. Both are already
    // recorded on the row; neither is worth retrying inside this loop.
    const outcome = await runVerification(admin, run.id as string)
    if (outcome) completed++
    else skipped++
  }

  return NextResponse.json({ ok: true, completed, skipped })
}
