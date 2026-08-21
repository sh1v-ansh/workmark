import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { syncRepoGrants } from '@/lib/github/sync-grants'

// This route does slow third-party work — paginates the installation's repo list. Without an explicit
// maxDuration it inherits the platform default and gets killed mid-flight.
//
// 60s is the value that is safe on every Vercel plan — Hobby without Fluid
// Compute caps here, and a deployment whose maxDuration exceeds the plan
// limit fails to build rather than being clamped. Raise it if the project
// is on Pro; the durable fix is not a bigger number, it is doing this work
// in a background job so no single request has to finish it.
export const maxDuration = 60

/**
 * POST /api/github/repos/sync
 *
 * Refreshes the signed-in student's repo grants against what the GitHub
 * App installation can actually see — in particular each repo's real
 * public/private visibility, which can't be inferred locally and which
 * older grant rows don't carry correctly at all.
 *
 * Separate from /api/github/scan so the repo picker can show accurate
 * visibility BEFORE anything gets scanned — the whole point of the
 * private-repo opt-in is that the student sees what's private first.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: connection } = await admin
    .from('github_connections')
    .select('installation_id')
    .eq('student_id', user.id)
    .maybeSingle()
  if (!connection) {
    return NextResponse.json({ error: 'GitHub not connected.' }, { status: 400 })
  }

  try {
    const result = await syncRepoGrants(admin, user.id, connection.installation_id)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[api/github/repos/sync] failed:', err)
    return NextResponse.json({ error: `Sync failed: ${(err as Error).message}` }, { status: 500 })
  }
}
