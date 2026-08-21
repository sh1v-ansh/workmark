// What one step of each job kind actually does.
//
// The contract every runner obeys: do ONE unit of work, be idempotent, and
// never throw for a failure that belongs to that unit alone. A repo that
// can't be read is a failed step with a reason, not a failed job — the
// student's other repos still deserve to be scanned.

import type { SupabaseClient } from '@supabase/supabase-js'
import { processRepo } from '@/lib/skills/evidence'
import type { Job, JobStep } from './queue'

export interface StepOutcome {
  ok: boolean
  detail: string
}

/**
 * Scan one granted repo.
 *
 * The GitHub connection is re-read per step rather than frozen into the job
 * at creation time: a scan now spans minutes, and an installation can be
 * revoked or reinstalled in that window. Reading it fresh means a revoked
 * install fails the remaining steps honestly instead of retrying against a
 * token that no longer exists.
 */
async function runGithubScanStep(
  admin: SupabaseClient,
  job: Job,
  step: JobStep,
): Promise<StepOutcome> {
  const { data: connection } = await admin
    .from('github_connections')
    .select('installation_id, github_login')
    .eq('student_id', job.student_id)
    .maybeSingle()

  if (!connection?.github_login) {
    return { ok: false, detail: 'GitHub is no longer connected.' }
  }

  // The grant is re-read too, and re-checked for revocation: a student who
  // turns a private repo off mid-scan means it, and the queued step must
  // respect that rather than scanning it because it was enabled a minute ago.
  const { data: grant } = await admin
    .from('github_repo_grants')
    .select('id, repo_full_name, scan_enabled, revoked_at')
    .eq('id', step.id)
    .maybeSingle()

  if (!grant || grant.revoked_at || !grant.scan_enabled) {
    return { ok: true, detail: 'Skipped — no longer enabled for scanning.' }
  }

  const result = await processRepo(
    admin,
    job.student_id,
    connection.installation_id,
    connection.github_login,
    grant.repo_full_name,
    grant.id,
  )

  if (result.skipped) {
    return { ok: true, detail: result.skipReason ?? 'Skipped.' }
  }

  const count = result.evidenceWritten.length
  if (count === 0 && result.priorsWritten.length > 0) {
    return { ok: true, detail: 'Read, but no commits of yours found here.' }
  }
  return {
    ok: true,
    detail: count === 0 ? 'Nothing recognisable found.' : `${count} skill${count === 1 ? '' : 's'} recorded.`,
  }
}

export async function runStep(
  admin: SupabaseClient,
  job: Job,
  step: JobStep,
): Promise<StepOutcome> {
  switch (job.kind) {
    case 'github_scan':
      return runGithubScanStep(admin, job, step)
    default: {
      // Exhaustiveness: a new kind added to JobKind without a runner should
      // fail to compile here rather than silently no-op in production.
      const unreachable: never = job.kind
      return { ok: false, detail: `Unknown job kind: ${String(unreachable)}` }
    }
  }
}
