import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { kickJob } from '@/lib/jobs/queue'

/**
 * A job untouched for this long has lost its chain. Same threshold the cron
 * sweeper uses, so the two agree about what "stalled" means.
 */
const STALL_SECONDS = 90

/**
 * GET /api/jobs/[id]
 *
 * Progress for the polling UI. Runs under the student's own session, so
 * the "Students: read own jobs" RLS policy is what enforces ownership —
 * there is no service-role client here on purpose. A student asking for
 * someone else's job id gets the same 404 as one asking for a job that
 * doesn't exist, which is the correct amount of information to give.
 *
 * It also restarts a stalled job, which needs explaining.
 *
 * The worker normally chains itself from step to step, but that chain is a
 * fire-and-forget HTTP call and can be lost to a cold start or a torn-down
 * function. The cron sweeper is the designed safety net — except on Vercel's
 * Hobby plan it may only run once a day, and locally it never runs at all.
 * A student would sit watching a progress bar that had already stopped, for
 * up to twenty-four hours.
 *
 * So the poll doubles as the sweeper. The person most motivated to notice a
 * stuck scan is the one waiting on it, and they are already asking every few
 * seconds. Kicking a job that is progressing normally costs nothing:
 * claim_job() hands the lease to one caller and everyone else returns
 * immediately, which is what makes this safe to call on every poll.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const { data: job } = await supabase
    .from('jobs')
    .select('id, kind, status, steps, total_steps, completed_steps, result, error, created_at, updated_at, finished_at')
    .eq('id', id)
    .maybeSingle()

  if (!job) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  const unfinished = job.status === 'queued' || job.status === 'running'
  const idleFor = Date.now() - new Date(job.updated_at).getTime()

  if (unfinished && idleFor > STALL_SECONDS * 1000) {
    // Not awaited: the student is waiting on this response, and the restart
    // is a side effect they'll see on the next poll rather than this one.
    kickJob(job.id)
  }

  return NextResponse.json({ job })
}
