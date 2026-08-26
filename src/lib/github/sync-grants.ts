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
import { rankRepos } from '@/lib/github/rank-repos'

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
  // Everything the ranking needs comes back in this same listing, so
  // capturing it costs nothing — which is the whole point. If working out a
  // repo's rank took its own request, ranking 300 repos would cost 300
  // requests and we would not have solved the problem we set out to solve.
  interface LiveRepo {
    full_name: string
    private: boolean
    fork: boolean
    archived: boolean
    size: number
    pushed_at: string | null
    created_at: string | null
    description: string | null
    language: string | null
    stargazers_count: number
    has_pages: boolean
  }
  const repositories: LiveRepo[] = []
  for (let page = 1; ; page++) {
    const { data } = await octokit.rest.apps.listReposAccessibleToInstallation({ per_page: 100, page })
    repositories.push(...(data.repositories ?? []).map((r) => ({
      full_name: r.full_name,
      private: !!r.private,
      fork: !!r.fork,
      archived: !!r.archived,
      size: r.size ?? 0,
      pushed_at: r.pushed_at ?? null,
      created_at: r.created_at ?? null,
      description: r.description ?? null,
      language: r.language ?? null,
      stargazers_count: r.stargazers_count ?? 0,
      has_pages: !!r.has_pages,
    })))
    if ((data.repositories ?? []).length < 100) break
  }

  const { data: existingRows, error: readErr } = await supabase
    .from('github_repo_grants')
    .select('id, repo_full_name, is_private, scan_enabled, scan_choice, revoked_at')
    .eq('student_id', studentId)
  if (readErr) throw readErr

  // Repos a project brief points at. The student told us this is their
  // work, which outranks anything the ranking would infer.
  const { data: briefRepos } = await supabase
    .from('project_briefs')
    .select('repo_full_name')
    .eq('student_id', studentId)
    .not('repo_full_name', 'is', null)
  const briefLinked = new Set((briefRepos ?? []).map((b) => b.repo_full_name as string))

  const existing = new Map((existingRows ?? []).map((r) => [r.repo_full_name, r]))
  const liveNames = new Set(repositories.map((r) => r.full_name))
  let changed = 0

  // Rank everything first, so each row's write knows whether this repo made
  // the default cut.
  const ranked = rankRepos(repositories.map((repo) => {
    const row = existing.get(repo.full_name)
    return {
      repoFullName: repo.full_name,
      isPrivate: repo.private,
      isFork: repo.fork,
      isArchived: repo.archived,
      sizeKb: repo.size,
      pushedAt: repo.pushed_at,
      createdAtGh: repo.created_at,
      description: repo.description,
      primaryLanguage: repo.language,
      stars: repo.stargazers_count,
      hasPages: repo.has_pages,
      scanChoice: (row?.scan_choice as 'on' | 'off' | null) ?? null,
      linkedToBrief: briefLinked.has(repo.full_name),
    }
  }))
  const rankedByName = new Map(ranked.map((r) => [r.repoFullName, r]))

  for (const repo of repositories) {
    const row = existing.get(repo.full_name)
    const rank = rankedByName.get(repo.full_name)!

    const metadata = {
      is_private: repo.private,
      is_fork: repo.fork,
      is_archived: repo.archived,
      size_kb: repo.size,
      pushed_at: repo.pushed_at,
      created_at_gh: repo.created_at,
      description: repo.description,
      primary_language: repo.language,
      stars: repo.stargazers_count,
      has_pages: repo.has_pages,
      rank_score: rank.score,
      rank_reason: rank.reason,
    }

    if (!row) {
      const { error } = await supabase.from('github_repo_grants').insert({
        student_id: studentId,
        installation_id: installationId,
        repo_full_name: repo.full_name,
        // Private still requires an explicit yes — the ranking decides what
        // is worth reading, never whether we're allowed to read it.
        scan_enabled: repo.private ? false : rank.enabled,
        ...metadata,
      })
      if (error) throw error
      changed++
      continue
    }

    // The student's word wins and is never overwritten. This used to force
    // every public repo back on at each sync, so turning one off did
    // nothing — it came back on the next time the picker loaded.
    const nextScanEnabled =
      row.scan_choice === 'on' ? true
      : row.scan_choice === 'off' ? false
      : repo.private ? false
      : rank.enabled

    const needsUpdate =
      row.is_private !== repo.private ||
      row.scan_enabled !== nextScanEnabled ||
      row.revoked_at !== null

    // Metadata is refreshed on every sync regardless, so the picker's
    // ordering and reasons don't go stale.
    const { error } = await supabase
      .from('github_repo_grants')
      .update({ ...metadata, scan_enabled: nextScanEnabled, revoked_at: null, installation_id: installationId })
      .eq('id', row.id)
    if (error) throw error
    if (needsUpdate) changed++
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
