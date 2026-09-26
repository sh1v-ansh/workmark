import { createClient } from '@/lib/supabase/server'
import { enforce } from '@/lib/rate-limit'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { cancelJob, findActiveJob } from '@/lib/jobs/queue'
import { startScan } from '@/lib/github/start-scan'

// This route no longer scans anything — it builds the work list and hands
// back a job id. It stays generous only because syncRepoGrants pages the
// installation's repo list, which is one slow-ish call, not dozens.
export const maxDuration = 60

/**
 * POST /api/github/scan
 *
 * Queues a scan of every currently-granted, scan-enabled repo and returns
 * immediately with a job id to poll. The actual work happens one repo at a
 * time in /api/jobs/step.
 *
 * This used to scan every repo inline. That meant the student was pinned to
 * the page for as long as it took, and — worse — a multi-repo scan simply
 * exceeded the serverless timeout and was killed partway with no way to
 * resume. Neither is fixable by making the scan faster; the request has to
 * stop being the thing that does the work.
 *
 * scan_enabled is a per-repo opt-in the student sets explicitly (defaults
 * on for public repos, off for private ones) — being granted access via the
 * GitHub App install picker is not by itself consent to scan, particularly
 * for a private repo that might be an employer's IP.
 */
/**
 * GET /api/github/scan — is a scan running right now?
 *
 * ── Why this had to exist ─────────────────────────────────────────────────
 * RescanButton knew about a scan only because it had started one: the job id
 * lived in component state and nowhere else. So the moment a student
 * navigated — from the dashboard to their record, say, which is the natural
 * thing to do while waiting — the button remounted knowing nothing, and
 * rendered as an ordinary "Rescan" as though nothing were happening.
 *
 * A scan takes minutes. A student who cannot tell "still working" from
 * "finished" from "broken" concludes broken, presses the button again, and
 * is told one is already running — which is the first confirmation they get
 * that anything was happening at all.
 *
 * The GitHub page never had this problem because its server component looks
 * the job up and seeds the client with it. This is the same answer, as an
 * endpoint, so every copy of the button gets it without each page having to
 * remember to pass it down.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const active = await findActiveJob(admin, user.id, 'github_scan')

  // No job is the common answer and is not an error — the button asks this
  // on every mount.
  if (!active) return NextResponse.json({ job: null })

  return NextResponse.json({
    job: {
      id: active.id,
      status: active.status,
      total_steps: active.total_steps,
      completed_steps: active.completed_steps,
    },
  })
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const limited = await enforce('scan', user.id)
  if (limited) return limited

  // Refuse before creating anything the deployment can't run. This used to
  // create the job, fail to kick it, log to a console nobody reads, and tell
  // the student "scanning 25 repos" — which then sat at 0/25 forever,
  // surviving logout, with no way to tell it was never going to start.
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const result = await startScan(admin, user.id, 'button')
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result)
}

/**
 * DELETE /api/github/scan — stop the scan in flight and discard the rest.
 *
 * Evidence from steps that already finished stays: that work genuinely
 * happened, and deleting it would misrepresent the past. What's discarded is
 * the remaining plan.
 */
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const active = await findActiveJob(admin, user.id, 'github_scan')
  if (!active) return NextResponse.json({ ok: true, cancelled: false, message: 'No scan is running.' })

  const cancelled = await cancelJob(admin, active.id, user.id)
  return NextResponse.json({
    ok: true,
    cancelled,
    message: cancelled
      ? 'Scan stopped. Repos already read stayed on your record.'
      : 'That scan had already finished.',
  })
}
