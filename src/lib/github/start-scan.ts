import type { SupabaseClient } from '@supabase/supabase-js'
import { syncRepoGrants } from './sync-grants'
import { createJob, findActiveJob, kickJob, workerReachable, type JobStep } from '@/lib/jobs/queue'
import { record } from '@/lib/analytics/record'

export type StartScanResult =
  | { ok: true; jobId: string; totalSteps?: number; alreadyRunning?: boolean }
  | { ok: false; status: number; error: string }

/**
 * Start a scan of every repository the student has switched on. Shared by
 * the Scan button and the GitHub connect callback, which starts the first
 * scan on its own: connecting felt like the finish line, and most people
 * stopped there.
 *
 * Only scan_enabled repos: public ones by default, private ones only when
 * the student chose them (sync-grants.ts).
 */
export async function startScan(admin: SupabaseClient, userId: string, source: 'button' | 'connect'): Promise<StartScanResult> {
  const reachable = workerReachable()
  if (!reachable.ok) {
    console.error('[start-scan] worker unreachable:', reachable.reason)
    return { ok: false, status: 503, error: 'Scanning is misconfigured on this deployment, so nothing was started. Please report this.' }
  }

  const { data: connection } = await admin
    .from('github_connections')
    .select('installation_id, github_login')
    .eq('student_id', userId)
    .maybeSingle()
  if (!connection) return { ok: false, status: 400, error: 'GitHub not connected.' }
  if (!connection.github_login) {
    return { ok: false, status: 400, error: 'GitHub account has no login on file — try reconnecting.' }
  }

  const active = await findActiveJob(admin, userId, 'github_scan')
  if (active) return { ok: true, jobId: active.id, alreadyRunning: true }

  // The connect callback has only just synced; the button syncs so a repo
  // created a minute ago is included.
  if (source === 'button') {
    try {
      await syncRepoGrants(admin, userId, connection.installation_id)
    } catch (err) {
      console.error('[start-scan] grant sync failed, queueing off existing grants:', err)
    }
  }

  const { data: grants } = await admin
    .from('github_repo_grants')
    .select('id, repo_full_name')
    .eq('student_id', userId)
    .eq('scan_enabled', true)
    .is('revoked_at', null)
  if (!grants || grants.length === 0) {
    return { ok: false, status: 400, error: 'No repos enabled for scanning yet — pick which repos to scan below, then scan again.' }
  }

  const steps: JobStep[] = grants.map((g) => ({ id: g.id, label: g.repo_full_name, status: 'pending' }))
  const job = await createJob(admin, userId, 'github_scan', steps)
  void record(admin, 'scan_started', userId, { repos: steps.length, source })
  kickJob(job.id)
  return { ok: true, jobId: job.id, totalSteps: steps.length }
}
