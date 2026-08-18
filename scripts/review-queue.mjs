// The reviewer's tool for §3's human-review queue.
//
// A CLI rather than an admin page, deliberately: there is no admin role
// in the schema, and inventing one to serve a queue that one person reads
// would be a permission system pretending to be more than it is. The
// reviewer is whoever holds the service key, which is exactly true today.
//
// Approving writes an artifact with verification_method 'human_review' —
// the same evidence path a scanned repo takes, just with a person as the
// verifier instead of a deployment record. It does NOT write
// skill_evidence: a reviewer confirms the work is real and the student's,
// not which skills it demonstrates at what level. Skill attribution stays
// with the scanner, and non-code work simply has none.
//
// Usage:
//   node --env-file=.env scripts/review-queue.mjs            # list pending
//   node --env-file=.env scripts/review-queue.mjs approve <id> "note"
//   node --env-file=.env scripts/review-queue.mjs reject  <id> "reason"

import { createClient } from '@supabase/supabase-js'

// Node 20 has no global WebSocket, which @supabase/supabase-js's realtime
// client demands at construction — even though this script never uses
// realtime. Polyfill it from `ws` so the CLI runs on Node 20 (drop this
// once the toolchain is on Node 22+, which ships a native WebSocket).
import WebSocket from 'ws'
globalThis.WebSocket ??= WebSocket

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const [command, id, ...noteParts] = process.argv.slice(2)
const note = noteParts.join(' ').trim()

async function list() {
  const { data, error } = await admin
    .from('review_requests')
    .select('id, student_id, url, note, requested_at, students(full_name)')
    .eq('status', 'pending')
    .order('requested_at', { ascending: true })
  if (error) throw error

  if (!data || data.length === 0) {
    console.log('Nothing pending.')
    return
  }

  console.log(`${data.length} pending:\n`)
  for (const r of data) {
    const waited = Math.round((Date.now() - new Date(r.requested_at).getTime()) / (1000 * 60 * 60 * 24))
    console.log(`  ${r.id}`)
    console.log(`  ${r.students?.full_name ?? 'Unknown student'} · waiting ${waited} day(s)`)
    console.log(`  ${r.url}`)
    console.log(`  ${r.note.replace(/\n/g, ' ')}\n`)
  }
  console.log('Approve:  node --env-file=.env scripts/review-queue.mjs approve <id> "note"')
  console.log('Reject:   node --env-file=.env scripts/review-queue.mjs reject  <id> "reason"')
}

async function resolve(status) {
  if (!id) {
    console.error(`Usage: ${status} <id> "${status === 'approved' ? 'note' : 'reason'}"`)
    process.exit(1)
  }
  // A rejection with no reason is unactionable and reads as arbitrary —
  // the student sees this text.
  if (status === 'rejected' && !note) {
    console.error('A rejection needs a reason — the student sees it.')
    process.exit(1)
  }

  const { data: req, error: readErr } = await admin
    .from('review_requests')
    .select('id, student_id, url, status')
    .eq('id', id)
    .maybeSingle()
  if (readErr) throw readErr
  if (!req) {
    console.error('No such review request.')
    process.exit(1)
  }
  if (req.status !== 'pending') {
    console.error(`Already ${req.status}.`)
    process.exit(1)
  }

  let artifactId = null
  if (status === 'approved') {
    const { data: artifact, error: artErr } = await admin
      .from('artifacts')
      .insert({
        student_id: req.student_id,
        type: 'url',
        source: 'human_review',
        tier: 'tier_0',
        verification_method: 'human_review',
        deployment_url: req.url,
        verified_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (artErr) throw artErr
    artifactId = artifact.id
  }

  const { error: updateErr } = await admin
    .from('review_requests')
    .update({
      status,
      artifact_id: artifactId,
      reviewed_at: new Date().toISOString(),
      review_note: note || null,
    })
    .eq('id', id)
  if (updateErr) throw updateErr

  console.log(status === 'approved' ? `Approved. Artifact ${artifactId} created.` : 'Rejected.')
}

const run =
  command === 'approve' ? () => resolve('approved')
  : command === 'reject' ? () => resolve('rejected')
  : list

run().catch((err) => {
  console.error('\nFailed:', err.message ?? err)
  process.exit(1)
})
