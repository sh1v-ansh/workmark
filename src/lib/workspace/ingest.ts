// Writing extracted events into the workspaces that care about them.
//
// Runs under the service role, and has to: work_events is read-only to every
// signed-in user by policy, because an event a client can insert is an event
// a client can invent — and these are the rows a verified skill is
// ultimately built on.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExtractedEvent } from './events'

/**
 * Which account a GitHub login belongs to, for one workspace.
 *
 * Two conditions, and the second is the one that is easy to miss. The login
 * must map to a Workmark account through students.github_username — written
 * only by the App callback, and locked against the student themselves by the
 * column grants in v05_0024, which is what makes it usable as identity at
 * all. And that person must be a consented member of THIS workspace.
 *
 * A commit by somebody who has not agreed to be scanned still gets a row —
 * it is a fact about the repository, and dropping it would leave holes in
 * the project's history — but it is stored with the login only. Attribution
 * is what makes it personal data, and nobody is attributed without consent.
 */
async function attributionMap(
  admin: SupabaseClient,
  workspaceId: string,
  logins: string[],
): Promise<Map<string, string>> {
  const wanted = Array.from(new Set(logins.filter(Boolean)))
  if (wanted.length === 0) return new Map()

  const [{ data: students }, { data: members }] = await Promise.all([
    admin.from('students').select('id, github_username').in('github_username', wanted),
    admin
      .from('workspace_members')
      .select('account_id')
      .eq('workspace_id', workspaceId)
      .not('scan_consent_at', 'is', null)
      .is('removed_at', null),
  ])

  const consented = new Set((members ?? []).map((m) => m.account_id as string))
  const map = new Map<string, string>()
  for (const student of students ?? []) {
    const login = student.github_username as string | null
    const id = student.id as string
    if (login && consented.has(id)) map.set(login, id)
  }
  return map
}

export interface IngestResult {
  workspaces: number
  rows: number
}

/**
 * Record events against every workspace using that repository.
 *
 * Usually one. Two students can each link the same public repo to their own
 * project, though, and both should see the history — so this is a loop
 * rather than a single lookup.
 */
export async function ingestWorkEvents(
  admin: SupabaseClient,
  events: ExtractedEvent[],
): Promise<IngestResult> {
  if (events.length === 0) return { workspaces: 0, rows: 0 }

  const repoNames = Array.from(new Set(events.map((e) => e.repoFullName)))
  const { data: links } = await admin
    .from('workspace_repos')
    .select('workspace_id, repo_full_name')
    .in('repo_full_name', repoNames)
    .is('unlinked_at', null)

  // No workspace uses this repository. Extremely common — the App is
  // installed on everything a student granted, and most of it is not part
  // of a project. Returning early is the whole optimisation.
  if (!links || links.length === 0) return { workspaces: 0, rows: 0 }

  let rows = 0
  const workspaces = new Set<string>()

  for (const link of links) {
    const workspaceId = link.workspace_id as string
    const repoFullName = link.repo_full_name as string
    const forRepo = events.filter((e) => e.repoFullName === repoFullName)
    if (forRepo.length === 0) continue

    const attribution = await attributionMap(
      admin,
      workspaceId,
      forRepo.map((e) => e.authorLogin ?? '').filter(Boolean),
    )

    const { error } = await admin.from('work_events').upsert(
      forRepo.map((e) => ({
        workspace_id: workspaceId,
        repo_full_name: e.repoFullName,
        event_type: e.eventType,
        author_login: e.authorLogin,
        author_account_id: e.authorLogin ? attribution.get(e.authorLogin) ?? null : null,
        external_id: e.externalId,
        occurred_at: e.occurredAt,
        payload: e.payload,
      })),
      // The unique index is what makes a redelivered webhook a no-op rather
      // than a second copy. GitHub retries on any non-2xx, so this is a
      // normal occurrence, not an edge case.
      { onConflict: 'repo_full_name,event_type,external_id', ignoreDuplicates: true },
    )

    if (error) {
      // Never rethrown. A webhook that 500s is one GitHub will retry, and a
      // permanent failure here would have it retrying for days while the
      // grant-sync half of the same endpoint stops working too.
      console.error('[workspace/ingest] insert failed:', error)
      continue
    }

    workspaces.add(workspaceId)
    rows += forRepo.length
  }

  return { workspaces: workspaces.size, rows }
}
