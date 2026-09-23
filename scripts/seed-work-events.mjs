// Seeds work_events for a workspace so the submit → check → confirm path can
// be exercised without waiting on real GitHub traffic.
//
// Why this exists: verification reads work_events, and work_events is filled
// only by the GitHub App webhook. That is the right design — an event a
// client can insert is an event a client can invent — but it means the whole
// second half of the feature is untestable locally until somebody pushes real
// commits to a real linked repository and waits for the delivery.
//
// This writes the same rows the webhook would, under the service role. It is
// a TEST FIXTURE. Do not reach for it to "fix" a project whose events did not
// arrive: the fix there is the webhook, and inventing evidence is exactly the
// thing work_events is shaped to prevent.
//
// Usage:
//   node --env-file=.env.local scripts/seed-work-events.mjs <workspace-id> [--author <github-login>]
//
// Run it from the repo/ directory (that is where .env.local lives), and pass a
// real id with no angle brackets — a shell reads < and > as redirection.
// Running it with no arguments lists the projects you can use.
//
// The author login should match students.github_username for whoever the
// tasks are assigned to — attribution runs through that column, and a
// mismatch is the usual reason author_account_id comes back null.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  console.error('Run this from the repo/ directory, which is where .env.local lives.')
  process.exit(1)
}

const args = process.argv.slice(2)
const workspaceId = args.find((a) => !a.startsWith('--'))
const authorFlag = args.indexOf('--author')
const authorOverride = authorFlag >= 0 ? args[authorFlag + 1] : null

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// No id given — list what there is rather than printing a usage line and
// leaving somebody to go and find a UUID by hand.
if (!workspaceId) {
  const { data: projects } = await admin
    .from('workspaces')
    .select('id, title, status, workspace_repos(repo_full_name)')
    .order('created_at', { ascending: false })
    .limit(20)

  if (!projects || projects.length === 0) {
    console.error('There are no projects yet, so there is nothing to seed events onto.')
    console.error('')
    console.error('Create one first: sign in, go to /workspaces, "New project", then link a')
    console.error('repository — a project cannot leave draft without one. Come back with its id')
    console.error('(it is in the URL: /workspaces/<id>).')
    process.exit(1)
  }

  console.error('Pass one of these project ids:')
  console.error('')
  for (const p of projects) {
    const repo = p.workspace_repos?.[0]?.repo_full_name ?? 'no repo linked'
    console.error(`  ${p.id}  ${p.status.padEnd(9)} ${p.title}  (${repo})`)
  }
  console.error('')
  console.error('  node --env-file=.env.local scripts/seed-work-events.mjs <id> [--author <login>]')
  console.error('')
  console.error('Note: no angle brackets. Your shell reads < and > as redirection.')
  process.exit(1)
}

if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) {
  console.error(`"${workspaceId}" is not a project id.`)
  console.error('Run with no arguments to see the ids you can use.')
  process.exit(1)
}

const { data: repo } = await admin
  .from('workspace_repos')
  .select('repo_full_name')
  .eq('workspace_id', workspaceId)
  .is('unlinked_at', null)
  .limit(1)
  .maybeSingle()

if (!repo) {
  console.error('That project has no linked repository. Link one first — a project cannot leave draft without it.')
  process.exit(1)
}

// Attribute to whoever the submitted work belongs to, so the evidence window
// and the per-person filter in eventsForTask actually match something.
const { data: members } = await admin
  .from('workspace_members')
  .select('account_id')
  .eq('workspace_id', workspaceId)
  .not('accepted_at', 'is', null)
  .is('removed_at', null)

const { data: students } = await admin
  .from('students')
  .select('id, github_username')
  .in('id', (members ?? []).map((m) => m.account_id))

const author = authorOverride
  ?? (students ?? []).find((s) => s.github_username)?.github_username

if (!author) {
  console.error('No member has a github_username set, and no --author was given.')
  console.error('Attribution runs through students.github_username; without one every event lands unattributed.')
  process.exit(1)
}

const accountId = (students ?? []).find((s) => s.github_username === author)?.id ?? null

// Events are timestamped NOW so they fall inside the evidence window of any
// task currently in Doing or Submitted. A task's window runs from when it
// started to when it was submitted; events outside it are somebody else's
// work by definition.
const now = new Date()
const at = (minutesAgo) => new Date(now.getTime() - minutesAgo * 60_000).toISOString()
const stamp = now.getTime()

const events = [
  {
    event_type: 'push',
    occurred_at: at(45),
    external_id: `seed-push-${stamp}`,
    payload: {
      commitCount: 4,
      paths: [
        'src/app/api/auth/callback/route.ts',
        'src/lib/auth/google.ts',
        'tests/auth-callback.test.ts',
        'README.md',
      ],
      commits: [
        { message: 'Add Google OAuth callback route' },
        { message: 'Exchange the code for a session' },
        { message: 'Cover the callback with tests' },
        { message: 'Document the redirect URI' },
      ],
    },
  },
  {
    event_type: 'pull_request',
    occurred_at: at(20),
    external_id: `seed-pr-${stamp}`,
    payload: { number: 42, title: 'Google sign-in', merged: true, additions: 210, deletions: 14 },
  },
  {
    event_type: 'pull_request_review',
    occurred_at: at(18),
    external_id: `seed-review-${stamp}`,
    payload: { number: 42, state: 'approved' },
  },
  {
    event_type: 'check_suite',
    occurred_at: at(12),
    external_id: `seed-ci-${stamp}`,
    payload: { conclusion: 'success', status: 'completed' },
  },
]

const rows = events.map((e) => ({
  workspace_id: workspaceId,
  repo_full_name: repo.repo_full_name,
  author_login: author,
  author_account_id: accountId,
  ...e,
}))

const { error } = await admin.from('work_events').insert(rows)
if (error) {
  console.error('Insert failed:', error.message)
  process.exit(1)
}

console.log(`Seeded ${rows.length} work events on ${repo.repo_full_name}`)
console.log(`  attributed to ${author}${accountId ? '' : ' (unattributed — no matching student row)'}`)
console.log('')
console.log('Now: move a task to Doing, then Submitted, then press "Check my work".')
console.log('A task marked "no code" will go straight to a person instead — which is')
console.log('the path worth testing second.')
