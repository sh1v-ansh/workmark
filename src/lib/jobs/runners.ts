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

  // ── Say what happened, not just that something did ────────────────────
  // This used to report a count and nothing else, so "the rescan changed
  // nothing" was a claim neither the student nor we could check. A scan that
  // read no commits, a scan that hit a rate limit and a scan that genuinely
  // found nothing all produced the same sentence, and they need opposite
  // responses.
  const count = result.evidenceWritten.length
  const gone = result.retracted.length
  const d = result.diagnostics

  if (count === 0 && result.priorsWritten.length > 0) {
    return {
      ok: true,
      detail: d?.partial
        ? 'Read, but GitHub cut us off partway — nothing was changed.'
        : 'Read, but no commits of yours found here. If you commit from another email, tell us on this page.',
    }
  }

  const parts: string[] = []
  if (count > 0) parts.push(`${count} skill${count === 1 ? '' : 's'} recorded`)
  if (gone > 0) parts.push(`${gone} no longer supported`)
  if (parts.length === 0) parts.push('Nothing recognisable found')
  // Only when it matters: a partial scan is why nothing was taken off, and a
  // student comparing two runs deserves to know that rather than conclude
  // the product ignored them.
  if (d?.partial) parts.push('read partially, so nothing was removed')
  else if (d && !d.couldRetract && gone === 0) parts.push('nothing removed')

  return { ok: true, detail: `${parts.join(' · ')}.` }
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
