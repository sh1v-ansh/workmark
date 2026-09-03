import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { reportError } from '@/lib/observability/report'
import { checkRateLimit } from '@/lib/rate-limit'

/**
 * POST /api/client-error
 *
 * Where the React error boundaries send what they caught. Without this,
 * a page that crashes in the browser is completely invisible — the server
 * returned 200 and rendered fine, and the only signal is a user who
 * doesn't come back.
 *
 * Rate limited hard, and for an unusual reason: this endpoint accepts
 * attacker-controlled text and writes it to a table an admin reads. A
 * crash loop in a browser tab could also file the same error a few hundred
 * times a minute on its own, without anybody meaning any harm.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const limit = await checkRateLimit({
    key: `client-error:${user?.id ?? 'anon'}`,
    limit: 20,
    windowSeconds: 300,
  })
  // Silently accepted rather than refused: the client can do nothing useful
  // with a 429 here, and a boundary that retries because reporting failed
  // would make the loop worse.
  if (!limit.allowed) return NextResponse.json({ ok: true })

  let body: { context?: string; message?: string; stack?: string; pageUrl?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  if (!body.message) return NextResponse.json({ ok: true })

  await reportError({
    source: 'client',
    context: (body.context ?? 'client').slice(0, 200),
    error: Object.assign(new Error(body.message.slice(0, 2000)), { stack: body.stack?.slice(0, 8000) }),
    userId: user?.id ?? null,
    pageUrl: body.pageUrl ?? null,
    userAgent: request.headers.get('user-agent'),
  })

  return NextResponse.json({ ok: true })
}
