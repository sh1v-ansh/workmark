import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /auth/callback — turn the code in an email link into a session.
 *
 * ── Why a route handler and not a page ────────────────────────────────────
 * The browser client is @supabase/ssr's, which uses PKCE, so the link in a
 * recovery email carries `?code=` rather than a ready-made token. Exchanging
 * it writes the session cookie, and in the App Router only a route handler
 * can set cookies — a server component's attempt is swallowed, which is what
 * the empty catch in lib/supabase/server.ts is about. A page here would
 * appear to work and leave the user signed out.
 *
 * ── Why `next` is checked ─────────────────────────────────────────────────
 * It comes from a URL, so it is attacker-controlled. Redirecting to whatever
 * it says would make this an open redirect on an authenticated session —
 * somebody could mail a real Workmark reset link that lands the signed-in
 * user on a page they control. Only a path on this site is allowed, and
 * "//evil.test" is a path to a browser but a host to a URL parser, so the
 * leading-slash check has to exclude it explicitly.
 */
// In lib/ rather than here so it can be tested: a route file may only export
// HTTP handlers, so a helper exported from one is a build error.
import { safeNext } from '@/lib/auth/redirect'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = safeNext(url.searchParams.get('next'))
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? url.origin

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=link_invalid`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    // Almost always an expired or already-used link, which is a normal thing
    // to hit: recovery links are one-shot and Supabase expires them in an
    // hour. The login page says so in words rather than showing a stack.
    console.error('[auth/callback] exchange failed:', error.message)
    return NextResponse.redirect(`${origin}/login?error=link_expired`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
