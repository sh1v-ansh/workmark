import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { record } from '@/lib/analytics/record'

function serviceClient() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
async function hasStudentProfile(id: string): Promise<boolean> {
  const { data } = await serviceClient().from('students').select('id').eq('id', id).maybeSingle()
  return !!data
}
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { hasGithubConsent } from '@/lib/github/consent'

/**
 * GET /api/github/app/install
 *
 * Redirects the signed-in student to GitHub's App installation page. Once
 * they approve (choosing "All repositories" or specific ones), GitHub
 * redirects to the App's configured Setup URL — /api/github/app/callback —
 * with an installation_id. Same CSRF-cookie pattern as the old OAuth flow:
 * a random state value set here must round-trip back at callback time.
 *
 * Requires a recorded consent first, and redirects to the screen that
 * collects it if there isn't one. GitHub's own screen says "read access to
 * code and metadata", which describes a permission rather than a purpose.
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

  // Nobody reaches GitHub's install screen without having read ours first.
  // The check is here rather than only on the buttons that link here,
  // because a button added later would silently skip it — and "we can't
  // show what this person agreed to" is not a state this route may create.
  if (!(await hasGithubConsent(supabase, user.id))) {
    return NextResponse.redirect(new URL('/student/github/consent', request.url))
  }

  const appSlug = process.env.GITHUB_APP_SLUG
  if (!appSlug) {
    return NextResponse.redirect(new URL('/student/dashboard?gh_error=not_configured', request.url))
  }

  // Every Connect GitHub button lands here, so this is the one place that
  // counts them all (onboarding step 3, the GitHub page, the dashboard).
  if (await hasStudentProfile(user.id)) {
    await record(serviceClient(), 'github_connect_started', user.id)
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
