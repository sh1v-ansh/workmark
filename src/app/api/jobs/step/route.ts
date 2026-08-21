import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { claimJob, completeStep, kickJob, nextPendingStep, releaseJob } from '@/lib/jobs/queue'
import { runStep } from '@/lib/jobs/runners'

// One step, not one job. The whole point of the queue is that this number
// bounds a single unit of work — one repo — rather than all of them, so it
// is comfortably met on every plan and stops being a correctness risk.
export const maxDuration = 60

/**
 * POST /api/jobs/step  { jobId }
 *
 * Runs exactly one pending step of a job, then chains to itself for the
 * next one. Not a user-facing route: it is called by the enqueueing request
 * and by the cron sweeper, both of which present CRON_SECRET.
 *
 * Safe to call concurrently and safe to call on a finished job. claim_job()
 * hands the lease to exactly one caller; everyone else gets `claimed: false`
 * and stops. That is what lets us have both a self-chaining worker and a
 * sweeper aiming at the same job without doing the work twice.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[jobs/step] CRON_SECRET is not set — the worker cannot authenticate')
    return NextResponse.json({ error: 'Worker not configured.' }, { status: 500 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  let jobId: string | undefined
  try {
    jobId = (await request.json())?.jobId
  } catch {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 400 })
  }
  if (!jobId) return NextResponse.json({ error: 'jobId required.' }, { status: 400 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const job = await claimJob(admin, jobId)
  if (!job) {
    // Finished, or someone else holds the lease. Both are fine.
    return NextResponse.json({ ok: true, claimed: false })
  }

  const step = nextPendingStep(job)
  if (!step) {
    // Claimed a job with nothing left to do — finish it rather than leaving
    // it 'running' forever with a lease that keeps expiring and re-claiming.
    await completeStep(admin, job, '', { ok: true, detail: '' })
    return NextResponse.json({ ok: true, claimed: true, done: true })
  }

  let outcome
  try {
    outcome = await runStep(admin, job, step)
  } catch (err) {
    // The step's own failure, not the job's. Record it and move on so one
    // bad repo can't block the rest — completeStep counts it as finished.
    outcome = { ok: false, detail: (err as Error).message.slice(0, 300) }
  }

  let done: boolean
  try {
    ;({ done } = await completeStep(admin, job, step.id, outcome))
  } catch (err) {
    // Couldn't even record the result — release the lease so the sweeper
    // retries rather than leaving the job wedged behind a live lease.
    console.error('[jobs/step] could not record step result:', err)
    await releaseJob(admin, job.id)
    return NextResponse.json({ error: 'Could not record progress.' }, { status: 500 })
  }

  if (!done) kickJob(job.id)

  return NextResponse.json({ ok: true, claimed: true, done, step: step.label })
}
