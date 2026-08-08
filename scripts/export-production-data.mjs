// Dumps every row currently in the database to a local JSON file, before
// Phase 0's destructive schema rebuild. Read-only — this script never writes
// anything. Run this and keep the output before any migration touches the
// live database.
//
// This exists because the Phase 0 rebuild replaces `projects` with
// `listings` + `engagements`, restructures `applications`, and drops
// `peer_records` entirely (Tier 0.5 is now scan-derived, not attested) — a
// genuinely different schema, not an extension of the old one. The 4 real
// students and 1 real listing currently in production need to survive that
// as data, even though the tables they live in won't survive it as schema.
//
// Usage:
//   node --env-file=.env.local scripts/export-production-data.mjs
//
// Writes ./export-<timestamp>.json and prints a summary to stdout — paste
// the summary back so the next step (re-insertion into the new schema) can
// be scoped accurately.

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  console.error('Run with: node --env-file=.env.local scripts/export-production-data.mjs')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Every table in the current schema. Dumped in full — at production's
// current size (4 students, 1 listing) there's no reason to filter, and
// filtering risks silently dropping something that matters.
const TABLES = [
  'students', 'companies', 'faculty',
  'projects', 'applications', 'application_messages',
  'contact_shares', 'peer_records', 'verified_work_records',
  'milestones', 'issue_flags',
  'github_evidenced_skills', 'github_connections', 'github_repo_profiles',
  'employer_profiles',
]

async function dumpTable(table) {
  const { data, error } = await admin.from(table).select('*')
  if (error) {
    // A table that doesn't exist yet (e.g. a fresh project) shouldn't kill
    // the whole export — record the error and move on.
    return { rows: [], error: error.message }
  }
  return { rows: data ?? [], error: null }
}

async function main() {
  const dump = {}
  const summary = []

  for (const table of TABLES) {
    const { rows, error } = await dumpTable(table)
    dump[table] = rows
    summary.push(error ? `  ${table}: ERROR — ${error}` : `  ${table}: ${rows.length} row(s)`)
  }

  // Auth users aren't a public-schema table — pull them separately so the
  // 4 real students' auth ids are captured alongside their profile rows.
  // These ids are what let re-insertion keep everyone logged in.
  const { data: authData, error: authErr } = await admin.auth.admin.listUsers({ perPage: 200 })
  if (authErr) throw authErr
  dump.auth_users = authData.users.map((u) => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    role: u.user_metadata?.role ?? null,
  }))
  summary.push(`  auth_users: ${dump.auth_users.length} row(s)`)

  const filename = `export-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  writeFileSync(filename, JSON.stringify(dump, null, 2))

  console.log(`Exported to ${filename}\n`)
  console.log('Summary:')
  console.log(summary.join('\n'))
  console.log('\nStudents:')
  for (const s of dump.students) {
    console.log(`  ${s.id} — ${s.full_name ?? '(no name)'} — skills: ${(s.skills ?? []).join(', ') || '(none)'}`)
  }
  console.log('\nProjects (listings):')
  for (const p of dump.projects) {
    console.log(`  ${p.id} — "${p.title}" — poster_type: ${p.poster_type} — required_skills: ${(p.required_skills ?? []).join(', ') || '(none)'} — is_open: ${p.is_open}`)
  }
  console.log('\nPaste this summary back — it scopes the re-insertion script exactly.')
}

main().catch((err) => {
  console.error('\nExport failed:', err.message ?? err)
  process.exit(1)
})
