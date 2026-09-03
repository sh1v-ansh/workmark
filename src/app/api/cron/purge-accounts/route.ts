import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getGithubApp } from '@/lib/github/app'
import { GRACE_DAYS } from '@/lib/account/deletion'

export const maxDuration = 60

/** Don't try to empty the world in one tick if something has gone wrong. */
const MAX_PER_RUN = 25

/**
 * POST /api/cron/purge-accounts
 *
 * Destroys accounts whose grace period has run out.
 *
 * Woken once a day by pg_cron (see v05_0018) rather than doing the delete
 * in SQL, because the first step is revoking the GitHub App installation —
 * an HTTP call to GitHub that Postgres can't make. Leaving the installation
 * behind would mean GitHub still lists Workmark as having access to
 * somebody's repositories after they deleted their account, which is the
 * one thing this must not get wrong.
 *
 * The delete itself is `auth.users`, and everything cascades from it. There
 * is no tombstone row and no anonymized skeleton: a student's file is a
 * consumer report about them, and keeping a copy after they asked us not to
 * is exactly what they were trying to prevent. What survives is a row in
 * account_deletions holding an opaque id and three timestamps, so "did you
 * actually delete my account when I asked" has an answer.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron/purge-accounts] CRON_SECRET is not set')
    return NextResponse.json({ error: 'Not configured.' }, { status: 500 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const due = new Date(Date.now() - GRACE_DAYS * 86_400_000).toISOString()

  const { data: accounts, error } = await admin
    .from('accounts')
    .select('id, deletion_requested_at')
    .eq('status', 'deleting')
    .lt('deletion_requested_at', due)
    .limit(MAX_PER_RUN)

  if (error) {
    console.error('[cron/purge-accounts] could not read due accounts:', error)
    return NextResponse.json({ error: 'Query failed.' }, { status: 500 })
  }

  let purged = 0
  const notes: string[] = []

  for (const account of accounts ?? []) {
    const note: string[] = []

    // 1. GitHub first. If this fails we stop and try again tomorrow rather
    //    than deleting the row that tells us which installation to revoke —
    //    an orphaned installation with nothing pointing at it is
    //    unrecoverable, and it's the failure that matters most here.
    const { data: connection } = await admin
      .from('github_connections')
      .select('installation_id')
      .eq('student_id', account.id)
      .maybeSingle()

    if (connection?.installation_id) {
      try {
        await getGithubApp().octokit.request('DELETE /app/installations/{installation_id}', {
          installation_id: Number(connection.installation_id),
        })
        note.push('github revoked')
      } catch (err) {
        const status = (err as { status?: number }).status
        // 404: already uninstalled from GitHub's side, which is the same
        // end state we wanted. Anything else is a real failure.
        if (status === 404) {
          note.push('github already gone')
        } else {
          console.error('[cron/purge-accounts] GitHub revoke failed, deferring:', account.id, err)
          notes.push(`${account.id}: deferred, github revoke failed`)
          continue
        }
      }
    }

    // 2. The auth user. Everything else in the schema hangs off it by
    //    cascade — students, evidence, applications, engagements, consents.
    const { error: authError } = await admin.auth.admin.deleteUser(account.id)
    if (authError) {
      console.error('[cron/purge-accounts] auth delete failed:', account.id, authError)
      notes.push(`${account.id}: deferred, auth delete failed`)
      continue
    }

    await admin
      .from('account_deletions')
      .update({ purged_at: new Date().toISOString(), note: note.join('; ') || null })
      .eq('user_id', account.id)
      .is('purged_at', null)
      .is('restored_at', null)

    purged++
  }

  if (notes.length > 0) console.warn('[cron/purge-accounts]', notes.join(' | '))

  return NextResponse.json({ ok: true, due: (accounts ?? []).length, purged })
}
