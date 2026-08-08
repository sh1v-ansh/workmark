// GitHub App authentication — replaces the old per-user OAuth token model.
// Installation-scoped: the App is authenticated once (via its private key),
// then exchanges that for a short-lived installation access token scoped to
// exactly the repos that installation was granted. Nothing long-lived is
// stored in our DB — github_connections keeps the installation_id, not a
// token (see supabase/schema.sql).
//
// Env: GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_APP_WEBHOOK_SECRET.
// Private keys are PEM multi-line strings; most .env tooling can't hold a
// literal newline, so this accepts the common "\n"-escaped convention and
// unescapes it — set the env var value with literal `\n` between lines if
// your platform doesn't support real newlines in env vars.

import { App } from '@octokit/app'

function readPrivateKey(): string {
  const raw = process.env.GITHUB_APP_PRIVATE_KEY
  if (!raw) throw new Error('Missing GITHUB_APP_PRIVATE_KEY.')
  // Already a real multi-line PEM (e.g. loaded from a file or a platform
  // that supports newlines in env vars) — use as-is. Otherwise unescape.
  return raw.includes('\n') ? raw : raw.replace(/\\n/g, '\n')
}

let cachedApp: App | null = null

/** The GitHub App itself — authenticated as the App, not as any installation. */
export function getGithubApp(): App {
  if (cachedApp) return cachedApp

  const appId = process.env.GITHUB_APP_ID
  const webhookSecret = process.env.GITHUB_APP_WEBHOOK_SECRET
  if (!appId) throw new Error('Missing GITHUB_APP_ID.')
  if (!webhookSecret) throw new Error('Missing GITHUB_APP_WEBHOOK_SECRET.')

  cachedApp = new App({
    appId,
    privateKey: readPrivateKey(),
    webhooks: { secret: webhookSecret },
  })
  return cachedApp
}

/**
 * An Octokit client scoped to one installation — every call made with it is
 * automatically authenticated as an installation access token, refreshed as
 * needed. This is what every repo-scanning call should go through; never
 * authenticate as the App itself to read repo contents.
 */
export async function getInstallationOctokit(installationId: string | number) {
  const app = getGithubApp()
  return app.getInstallationOctokit(Number(installationId))
}
