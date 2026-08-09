import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getInstallationOctokit } from '@/lib/github/app'

/**
 * GET /api/github/app/callback
 *
 * GitHub's configured "Setup URL" for the App — lands here after the
 * student approves (or cancels) the installation, carrying
 * installation_id + the state we set in /install.
 *
 * Fetches the installation's currently-granted repos immediately rather
 * than waiting on the installation_repositories webhook to arrive, so the
 * student sees something without depending on webhook delivery timing.
 * The webhook (see ../webhook/route.ts) is what keeps grants in sync after
 * this point, when repos are added/removed later.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const installationId = url.searchParams.get('installation_id')
  const setupAction = url.searchParams.get('setup_action')
  const state = url.searchParams.get('state')

  const dashboardUrl = new URL('/student/dashboard', url)

  if (setupAction === 'request') {
    // Org installation pending admin approval — nothing to attach yet.
    dashboardUrl.searchParams.set('gh_error', 'installation_pending_approval')
    return NextResponse.redirect(dashboardUrl)
  }
  if (!installationId) {
    dashboardUrl.searchParams.set('gh_error', 'missing_installation_id')
    return NextResponse.redirect(dashboardUrl)
  }

  const cookieState = request.headers.get('cookie')?.match(/gh_app_state=([^;]+)/)?.[1]
  const cookieUserId = request.headers.get('cookie')?.match(/gh_app_user=([^;]+)/)?.[1]
  if (!state || !cookieState || state !== cookieState || !cookieUserId) {
    dashboardUrl.searchParams.set('gh_error', 'state_mismatch')
    return NextResponse.redirect(dashboardUrl)
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  try {
    const octokit = await getInstallationOctokit(installationId)
    const { data: installation } = await octokit.rest.apps.getInstallation({ installation_id: Number(installationId) })
    const accountLogin = 'login' in (installation.account ?? {}) ? (installation.account as { login: string }).login : null

    const { error: connErr } = await admin.from('github_connections').upsert({
      student_id: cookieUserId,
      installation_id: installationId,
      github_login: accountLogin,
      connected_at: new Date().toISOString(),
    })
    if (connErr) throw connErr

    // listReposAccessibleToInstallation returns the FULL current list, not
    // a diff, and this route re-runs on every reconnect — an upsert here
    // would silently reset scan_enabled back to its repo-visibility
    // default for every already-reviewed repo each time. Only inserting
    // repos genuinely new to this student's grants (never touching
    // existing rows) preserves whatever the student already chose.
    const { data: repos } = await octokit.rest.apps.listReposAccessibleToInstallation()
    const { data: existing } = await admin
      .from('github_repo_grants')
      .select('repo_full_name')
      .eq('student_id', cookieUserId)
    const existingNames = new Set((existing ?? []).map((g) => g.repo_full_name))
    const newRepos = (repos.repositories ?? []).filter((r) => !existingNames.has(r.full_name))
    if (newRepos.length > 0) {
      const grantRows = newRepos.map((r) => ({
        student_id: cookieUserId,
        installation_id: installationId,
        repo_full_name: r.full_name,
        is_private: !!r.private,
        scan_enabled: !r.private,
      }))
      const { error: grantErr } = await admin.from('github_repo_grants').insert(grantRows)
      if (grantErr) throw grantErr
    }

    if (accountLogin) {
      await admin.from('students').update({ github_username: accountLogin }).eq('id', cookieUserId)
    }

    dashboardUrl.searchParams.set('gh_connected', '1')
  } catch (err) {
    console.error('GitHub App callback failed:', err)
    dashboardUrl.searchParams.set('gh_error', 'callback_failed')
  }

  const response = NextResponse.redirect(dashboardUrl)
  response.cookies.delete('gh_app_state')
  response.cookies.delete('gh_app_user')
  return response
}
