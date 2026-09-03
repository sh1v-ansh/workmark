import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { kickJob } from '@/lib/jobs/queue'
import { recomputeCalibration } from '@/lib/skills/calibration'

export const maxDuration = 60

/** A job untouched for this long has lost its chain and needs a nudge. */
const STALL_SECONDS = 90

/** Don't kick the world in one tick if something has gone badly wrong. */
const MAX_PER_TICK = 20

/**
 * How long a finished job's record is kept.
 *
 * Job rows are operational telemetry, not part of the student's record —
 * unlike skill_evidence and evidence_audit, which are deliberately permanent
 * because a consumer report has to be auditable. A job's steps hold the
 * names of the student's private repos and one line about what was found in
 * each, and nothing needs that once the scan is over and the evidence it
 * produced has been written. Keeping it around is data we hold for no
 * purpose, so it goes. A week is long enough to debug a failed scan.
 */
const KEEP_FINISHED_DAYS = 7

/**
 * GET /api/cron/jobs
 *
 * The safety net. The worker normally chains itself from step to step, but
 * that chain is a fire-and-forget HTTP call and can be lost — a cold start,
 * a torn-down function, a transient network failure. Without this, a
 * student's scan would stop silently at step 3 and never resume, which is
 * the exact failure the queue exists to prevent.
 *
 * No longer on Vercel Cron. Hobby allows one run a day, which is useless as
 * a recovery mechanism — a dropped chain would stall for up to 24 hours. The
 * sweep now runs every minute from pg_cron inside Postgres (see
 * v05_0016_queue_feedback_cron.sql), which is free on every Supabase tier.
 *
 * This route stays as the manual and belt-and-braces path: it still works if
 * called with the secret, and it also does the purge and recalibration that
 * belong on a slower cadence than the sweep. Kicking a job that is already progressing is harmless:
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

  // Purge finished jobs past their keep window. Done here rather than in a
  // separate cron because it is the same "once a minute, tidy the queue"
  // responsibility, and a delete that finds nothing costs nothing.
  const purgeBefore = new Date(Date.now() - KEEP_FINISHED_DAYS * 86_400_000).toISOString()
  const { error: purgeError } = await admin
    .from('jobs')
    .delete()
    .in('status', ['succeeded', 'failed', 'cancelled'])
    .lt('finished_at', purgeBefore)
  if (purgeError) {
    // Not fatal — the sweep above is the part that keeps scans moving.
    console.error('[cron/jobs] purge of finished jobs failed:', purgeError)
  }

  // Recalibration used to be a script somebody had to remember to run, so a
  // skill could sit past its threshold indefinitely being scored against
  // bands that no longer described anyone. It runs here because this is
  // already the once-a-tick tidy-up, and because it's cheap when there's
  // nothing to do — the common case is a single query that finds no skill
  // over the line.
  let calibration = null
  try {
    calibration = await recomputeCalibration(admin)
    if (calibration.skillsSwitched.length > 0) {
      console.info('[cron/jobs] calibration switched:', calibration.skillsSwitched.join(', '))
    }
  } catch (err) {
    // Never at the cost of the sweep above, which is what keeps scans moving.
    console.error('[cron/jobs] calibration failed:', err)
  }

  return NextResponse.json({
    ok: true,
    kicked: (stalled ?? []).length,
    calibrated: calibration?.skillsSwitched.length ?? 0,
  })
}
