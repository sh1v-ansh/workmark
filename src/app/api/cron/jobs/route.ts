import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { kickJob } from '@/lib/jobs/queue'

export const maxDuration = 60

/** A job untouched for this long has lost its chain and needs a nudge. */
const STALL_SECONDS = 90

/** Don't kick the world in one tick if something has gone badly wrong. */
const MAX_PER_TICK = 20

/**
 * GET /api/cron/jobs
 *
 * The safety net. The worker normally chains itself from step to step, but
 * that chain is a fire-and-forget HTTP call and can be lost — a cold start,
 * a torn-down function, a transient network failure. Without this, a
 * student's scan would stop silently at step 3 and never resume, which is
 * the exact failure the queue exists to prevent.
 *
 * Runs every minute. Kicking a job that is already progressing is harmless:
 * claim_job() refuses the lease and the extra call returns immediately.
 *
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically when
 * the env var is set, which is the same secret the worker checks.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron/jobs] CRON_SECRET is not set — the sweeper cannot run')
    return NextResponse.json({ error: 'Not configured.' }, { status: 500 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const stalledBefore = new Date(Date.now() - STALL_SECONDS * 1000).toISOString()

  const { data: stalled, error } = await admin
    .from('jobs')
    .select('id')
    .in('status', ['queued', 'running'])
    .lt('updated_at', stalledBefore)
    .order('updated_at', { ascending: true })
    .limit(MAX_PER_TICK)

  if (error) {
    console.error('[cron/jobs] could not read stalled jobs:', error)
    return NextResponse.json({ error: 'Query failed.' }, { status: 500 })
  }

  for (const job of stalled ?? []) kickJob(job.id)

  return NextResponse.json({ ok: true, kicked: (stalled ?? []).length })
}
