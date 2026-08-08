import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

/**
 * GET /api/github/app/install
 *
 * Redirects the signed-in student to GitHub's App installation page. Once
 * they approve (choosing "All repositories" or specific ones), GitHub
 * redirects to the App's configured Setup URL — /api/github/app/callback —
 * with an installation_id. Same CSRF-cookie pattern as the old OAuth flow:
 * a random state value set here must round-trip back at callback time.
 *
 * Env: GITHUB_APP_SLUG (the App's URL-safe name, set when it was
 * registered on GitHub — distinct from GITHUB_APP_ID).
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const appSlug = process.env.GITHUB_APP_SLUG
  if (!appSlug) {
    return NextResponse.redirect(new URL('/student/dashboard?gh_error=not_configured', request.url))
  }

  const state = randomUUID()
  const installUrl = new URL(`https://github.com/apps/${appSlug}/installations/new`)
  installUrl.searchParams.set('state', state)

  const response = NextResponse.redirect(installUrl.toString())
  const cookieOpts = { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 600, sameSite: 'lax' as const, path: '/' }
  response.cookies.set('gh_app_state', state, cookieOpts)
  response.cookies.set('gh_app_user', user.id, cookieOpts)
  return response
}
