import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * GET /api/github/callback
 *
 * GitHub redirects the student here after they authorize (or reject). We:
 *   1. Verify the state matches the CSRF cookie we set in /oauth-start.
 *   2. Exchange the code for an access token via GitHub's token endpoint.
 *   3. Fetch the student's GitHub login for display.
 *   4. Upsert into github_connections (service_role — bypasses RLS).
 *   5. Redirect back to /student/dashboard with a success (or error) query flag.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const oauthError = url.searchParams.get('error')

  const dashboardUrl = new URL('/student/dashboard', url)

  // User rejected on GitHub's side, or GitHub returned an error.
  if (oauthError) {
    dashboardUrl.searchParams.set('gh_error', oauthError)
    return NextResponse.redirect(dashboardUrl)
  }
  if (!code) {
    dashboardUrl.searchParams.set('gh_error', 'missing_code')
    return NextResponse.redirect(dashboardUrl)
  }

  const cookieState = request.headers.get('cookie')?.match(/gh_oauth_state=([^;]+)/)?.[1]
  const cookieUserId = request.headers.get('cookie')?.match(/gh_oauth_user=([^;]+)/)?.[1]
  if (!state || !cookieState || state !== cookieState || !cookieUserId) {
    dashboardUrl.searchParams.set('gh_error', 'state_mismatch')
    return NextResponse.redirect(dashboardUrl)
  }

  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    dashboardUrl.searchParams.set('gh_error', 'not_configured')
    return NextResponse.redirect(dashboardUrl)
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? url.origin
  const redirectUri = `${siteUrl}/api/github/callback`

  // Exchange code for access token.
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
  })
  const tokenData = (await tokenRes.json()) as { access_token?: string; scope?: string; error?: string; error_description?: string }
  if (!tokenData.access_token) {
    dashboardUrl.searchParams.set('gh_error', tokenData.error ?? 'token_exchange_failed')
    return NextResponse.redirect(dashboardUrl)
  }

  // Fetch the GitHub login for display in the UI.
  const ghUserRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'workmark',
    },
  })
  const ghUser = ghUserRes.ok ? ((await ghUserRes.json()) as { login?: string }) : {}

  // Persist token + username via service role (bypasses RLS since the
  // authenticated session belongs to the same user but writes need service_role).
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { error: upsertErr } = await admin.from('github_connections').upsert({
    student_id: cookieUserId,
    github_login: ghUser.login ?? null,
    access_token: tokenData.access_token,
    scope: tokenData.scope ?? null,
    connected_at: new Date().toISOString(),
  })
  if (upsertErr) {
    dashboardUrl.searchParams.set('gh_error', 'db_upsert_failed')
    return NextResponse.redirect(dashboardUrl)
  }

  // Mirror the login onto students.github_username so the dashboard's
  // "connected" state flips without needing to fetch github_connections.
  if (ghUser.login) {
    await admin.from('students').update({ github_username: ghUser.login }).eq('id', cookieUserId)
  }

  dashboardUrl.searchParams.set('gh_connected', '1')
  const response = NextResponse.redirect(dashboardUrl)
  // Clean up the CSRF cookies.
  response.cookies.delete('gh_oauth_state')
  response.cookies.delete('gh_oauth_user')
  return response
}
