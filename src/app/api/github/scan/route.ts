import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { processRepo } from '@/lib/skills/evidence'

/**
 * POST /api/github/scan
 *
 * Scans every currently-granted (non-revoked) repo for the signed-in
 * student. Runs under service-role — skill_priors/skill_evidence/
 * evidence_audit/artifacts have no insert policy for regular users by
 * design (§10: system-computed, not user input), so this can't run as the
 * student's own session no matter how the route is invoked.
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
    .select('installation_id, github_login')
    .eq('student_id', user.id)
    .maybeSingle()
  if (!connection) {
    return NextResponse.json({ error: 'GitHub not connected.' }, { status: 400 })
  }
  if (!connection.github_login) {
    return NextResponse.json({ error: 'GitHub account has no login on file — try reconnecting.' }, { status: 400 })
  }

  const { data: grants } = await admin
    .from('github_repo_grants')
    .select('id, repo_full_name')
    .eq('student_id', user.id)
    .is('revoked_at', null)
  if (!grants || grants.length === 0) {
    return NextResponse.json({ error: 'No repos granted yet.' }, { status: 400 })
  }

  const results = []
  for (const grant of grants) {
    try {
      const result = await processRepo(
        admin, user.id, connection.installation_id, connection.github_login, grant.repo_full_name, grant.id,
      )
      results.push(result)
    } catch (err) {
      results.push({
        repoFullName: grant.repo_full_name,
        skipped: true,
        skipReason: `scan failed: ${(err as Error).message}`,
        priorsWritten: [],
        evidenceWritten: [],
      })
    }
  }

  return NextResponse.json({ ok: true, results })
}
