// Re-syncs github_repo_grants against what the installation can actually
// see on GitHub right now — the source of truth for which repos exist,
// and critically for whether each one is public or private.
//
// This exists because visibility can't be inferred or assumed: grant rows
// created before is_private existed all carry the column default rather
// than reality, a repo can be flipped public↔private at any time, and the
// installation_repositories webhook only reports adds/removes, never a
// visibility change. Anything deciding "is this safe to scan" has to read
// GitHub, not the local row.
//
// Consent model applied here (see also §10):
//   public  → scan_enabled = true, always. A public repo is already world-
//             readable; there's nothing to withhold.
//   private → scan_enabled is the student's explicit choice and is never
//             overwritten by a sync. Defaults to false on first sight, so
//             a private repo is never scanned before someone said yes.
//
// Requires a service-role client — this writes grant rows on behalf of a
// student outside their own session (the scan route runs server-side).

import type { SupabaseClient } from '@supabase/supabase-js'
import { getInstallationOctokit } from '@/lib/github/app'

export interface SyncGrantsResult {
  /** Repos visible to the installation right now. */
  seen: number
  /** Rows inserted, updated, or newly revoked — i.e. did anything change. */
  changed: number
}

export async function syncRepoGrants(
  supabase: SupabaseClient,
  studentId: string,
  installationId: string,
): Promise<SyncGrantsResult> {
  const octokit = await getInstallationOctokit(installationId)

  // Explicit pagination rather than a single call: the default page size
  // is 30, which is exactly the kind of boundary that silently truncates
  // and looks like "GitHub only shared some repos" instead of a bug.
  const repositories: { full_name: string; private: boolean }[] = []
  for (let page = 1; ; page++) {
    const { data } = await octokit.rest.apps.listReposAccessibleToInstallation({ per_page: 100, page })
    repositories.push(...(data.repositories ?? []).map((r) => ({ full_name: r.full_name, private: !!r.private })))
    if ((data.repositories ?? []).length < 100) break
  }

  const { data: existingRows, error: readErr } = await supabase
    .from('github_repo_grants')
    .select('id, repo_full_name, is_private, scan_enabled, revoked_at')
    .eq('student_id', studentId)
  if (readErr) throw readErr

  const existing = new Map((existingRows ?? []).map((r) => [r.repo_full_name, r]))
  const liveNames = new Set(repositories.map((r) => r.full_name))
  let changed = 0

  for (const repo of repositories) {
    const row = existing.get(repo.full_name)

    if (!row) {
      const { error } = await supabase.from('github_repo_grants').insert({
        student_id: studentId,
        installation_id: installationId,
        repo_full_name: repo.full_name,
        is_private: repo.private,
        scan_enabled: !repo.private,
      })
      if (error) throw error
      changed++
      continue
    }

    // Public repos are force-enabled every sync; private repos keep
    // whatever the student chose. A repo that just flipped private→public
    // therefore becomes scannable, and public→private keeps scanning
    // (it was already public when the evidence was gathered) unless the
    // student turns it off — which the picker lets them do.
    const nextScanEnabled = repo.private ? row.scan_enabled : true
    const needsUpdate =
      row.is_private !== repo.private ||
      row.scan_enabled !== nextScanEnabled ||
      row.revoked_at !== null

    if (needsUpdate) {
      const { error } = await supabase
        .from('github_repo_grants')
        .update({ is_private: repo.private, scan_enabled: nextScanEnabled, revoked_at: null, installation_id: installationId })
        .eq('id', row.id)
      if (error) throw error
      changed++
    }
  }

  // Anything we hold a live grant for that GitHub no longer shares has
  // had its access removed — revoke rather than delete (grant rows are
  // referenced by artifacts.access_grant_id, and provable revocability
  // is itself the FCRA-relevant record).
  for (const row of existingRows ?? []) {
    if (!liveNames.has(row.repo_full_name) && row.revoked_at === null) {
      const { error } = await supabase
        .from('github_repo_grants')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', row.id)
      if (error) throw error
      changed++
    }
  }

  return { seen: repositories.length, changed }
}
