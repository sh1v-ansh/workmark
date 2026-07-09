import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

/**
 * GET /api/github/oauth-start
 *
 * Starts our own GitHub OAuth flow. Bypasses Supabase's manual-linking beta.
 * Redirects the signed-in student to GitHub's authorization page. The student
 * approves, GitHub bounces them to /api/github/callback with a code, and we
 * exchange it for an access token that we store in github_connections.
 *
 * Env: GITHUB_OAUTH_CLIENT_ID + NEXT_PUBLIC_SITE_URL required.
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID
  if (!clientId) {
    return NextResponse.redirect(new URL('/student/dashboard?gh_error=not_configured', request.url))
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin
  const redirectUri = `${siteUrl}/api/github/callback`
  const scopes = 'read:user public_repo'
  const state = randomUUID()

  const authUrl = new URL('https://github.com/login/oauth/authorize')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', scopes)
  authUrl.searchParams.set('state', state)

  const response = NextResponse.redirect(authUrl.toString())
  // CSRF-guard cookies. Short-lived (10 min). httpOnly so browser JS can't read.
  const cookieOpts = { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 600, sameSite: 'lax' as const, path: '/' }
  response.cookies.set('gh_oauth_state', state, cookieOpts)
  response.cookies.set('gh_oauth_user', user.id, cookieOpts)
  return response
}
