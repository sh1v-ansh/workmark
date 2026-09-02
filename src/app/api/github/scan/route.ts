import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { syncRepoGrants } from '@/lib/github/sync-grants'
import { cancelJob, createJob, findActiveJob, kickJob, workerReachable, type JobStep } from '@/lib/jobs/queue'

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
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  // Refuse before creating anything the deployment can't run. This used to
  // create the job, fail to kick it, log to a console nobody reads, and tell
  // the student "scanning 25 repos" — which then sat at 0/25 forever,
  // surviving logout, with no way to tell it was never going to start.
  const reachable = workerReachable()
  if (!reachable.ok) {
    console.error('[api/github/scan] worker unreachable:', reachable.reason)
    return NextResponse.json(
      { error: 'Scanning is misconfigured on this deployment, so nothing was started. Please report this.' },
      { status: 503 },
    )
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: connection } = await admin
    .from('github_connections')
    .select('installation_id, github_login')
    .eq('student_id', user.id)
    .maybeSingle()
  if (!connection) {
    return NextResponse.json({ error: 'GitHub not connected.' }, { status: 400 })
  }
  if (!connection.github_login) {
    return NextResponse.json({ error: 'GitHub account has no login on file — try reconnecting.' }, { status: 400 })
  }

  // One scan at a time per student. Queueing a second while the first is
  // mid-flight would have two workers writing evidence for the same repos —
  // harmless thanks to the dedup rule, but it doubles the API spend and
  // makes the progress UI incoherent.
  const active = await findActiveJob(admin, user.id, 'github_scan')
  if (active) {
    return NextResponse.json({ ok: true, jobId: active.id, alreadyRunning: true })
  }

  // Re-sync visibility before building the work list: a repo flipped to
  // private since the last sync must not be scanned off a stale
  // is_private=false row just because the picker looked right earlier.
  try {
    await syncRepoGrants(admin, user.id, connection.installation_id)
  } catch (err) {
    console.error('[api/github/scan] grant sync failed, queueing off existing grants:', err)
  }

  const { data: grants } = await admin
    .from('github_repo_grants')
    .select('id, repo_full_name')
    .eq('student_id', user.id)
    .eq('scan_enabled', true)
    .is('revoked_at', null)
  if (!grants || grants.length === 0) {
    return NextResponse.json({ error: 'No repos enabled for scanning yet — pick which repos to scan below, then scan again.' }, { status: 400 })
  }

  const steps: JobStep[] = grants.map((g) => ({
    id: g.id,
    label: g.repo_full_name,
    status: 'pending',
  }))

  const job = await createJob(admin, user.id, 'github_scan', steps)
  kickJob(job.id)

  return NextResponse.json({ ok: true, jobId: job.id, totalSteps: steps.length })
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
