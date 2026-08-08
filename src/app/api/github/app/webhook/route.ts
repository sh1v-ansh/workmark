import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getGithubApp } from '@/lib/github/app'

/**
 * POST /api/github/app/webhook
 *
 * Keeps github_repo_grants in sync after the initial callback grant
 * (../callback/route.ts) — repos added/removed from an installation, or
 * the whole App uninstalled.
 *
 * Uses app.webhooks.verify() for signature checking only, deliberately not
 * the .on()/.receive() event-emitter API: getGithubApp() caches a
 * singleton App instance across warm serverless invocations, and
 * registering .on() handlers fresh on every request would accumulate
 * duplicate handlers on that same cached instance, firing a handler
 * multiple times for one event after enough warm invocations. A plain
 * signature check + switch on the parsed payload has no such state to
 * accumulate.
 *
 * Revoked grants are never deleted, only marked revoked_at — a grant row
 * can be referenced by artifacts.access_grant_id, and deleting a
 * referenced row would violate that foreign key (no ON DELETE CASCADE by
 * design — losing the record of what was granted, when, would itself be
 * an FCRA problem, since revocability must be provable, not just current).
 */
export async function POST(request: Request) {
  const app = getGithubApp()
  const signature = request.headers.get('x-hub-signature-256')
  const eventName = request.headers.get('x-github-event')
  const rawBody = await request.text()

  if (!signature || !eventName) {
    return NextResponse.json({ error: 'Missing signature or event headers.' }, { status: 400 })
  }

  const valid = await app.webhooks.verify(rawBody, signature)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 })
  }

  const payload = JSON.parse(rawBody)
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const installationId = String(payload.installation?.id ?? '')

  if (eventName === 'installation' && payload.action === 'deleted' && installationId) {
    const { error: revokeErr } = await admin
      .from('github_repo_grants')
      .update({ revoked_at: new Date().toISOString() })
      .eq('installation_id', installationId)
      .is('revoked_at', null)
    if (revokeErr) throw revokeErr

    const { error: connErr } = await admin
      .from('github_connections')
      .delete()
      .eq('installation_id', installationId)
    if (connErr) throw connErr
  }

  if (eventName === 'installation_repositories' && installationId) {
    const { data: connection } = await admin
      .from('github_connections')
      .select('student_id')
      .eq('installation_id', installationId)
      .maybeSingle()

    if (connection) {
      const added = (payload.repositories_added ?? []) as { full_name: string }[]
      const removed = (payload.repositories_removed ?? []) as { full_name: string }[]

      if (added.length > 0) {
        const { error } = await admin.from('github_repo_grants').upsert(
          added.map((r) => ({
            student_id: connection.student_id,
            installation_id: installationId,
            repo_full_name: r.full_name,
            revoked_at: null,
          })),
          { onConflict: 'student_id,repo_full_name' },
        )
        if (error) throw error
      }

      for (const r of removed) {
        const { error } = await admin
          .from('github_repo_grants')
          .update({ revoked_at: new Date().toISOString() })
          .eq('student_id', connection.student_id)
          .eq('repo_full_name', r.full_name)
        if (error) throw error
      }
    }
  }

  return NextResponse.json({ ok: true })
}
