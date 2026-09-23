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
import { Octokit as RestOctokit } from '@octokit/rest'
import { throttling } from '@octokit/plugin-throttling'
import { retry } from '@octokit/plugin-retry'

/**
 * The client every scan goes through, with the two plugins that stop a busy
 * afternoon looking like an empty record.
 *
 * ── Why this matters more than it sounds ──────────────────────────────────
 * There was no rate-limit handling anywhere. Every call site swallowed its
 * own failures, so a student with twenty-five repositories who ran out of
 * budget partway through got later repos recorded as "found nothing" — which
 * is indistinguishable from a repository that genuinely demonstrates
 * nothing, and lands on a permanent record either way.
 *
 * `throttling` waits out GitHub's own Retry-After instead of hammering
 * through it, which is also what keeps us out of secondary rate limiting —
 * the one that is triggered by concurrency rather than volume, and the one
 * a scanner opening dozens of file reads per repo is most likely to meet.
 *
 * ── Why the retry counts are small ────────────────────────────────────────
 * A scan step has sixty seconds. Retrying three times with GitHub's
 * suggested backoff can exceed that on its own, and a step killed by the
 * platform is worse than a repo that reported a problem: the first is
 * invisible and gets re-run from scratch, the second is recorded and makes
 * the scan refuse to retract. Twice is enough to ride out a blip.
 */
const THROTTLE = {
  onRateLimit(retryAfter: number, options: { method: string; url: string }, _o: unknown, retryCount: number) {
    console.warn(`[github] rate limited on ${options.method} ${options.url}; waiting ${retryAfter}s`)
    return retryCount < 2
  },
  onSecondaryRateLimit(retryAfter: number, options: { method: string; url: string }, _o: unknown, retryCount: number) {
    // Triggered by making too many requests at once rather than too many in
    // total. Worth retrying once: it clears quickly and the alternative is
    // recording an empty repository.
    console.warn(`[github] secondary rate limit on ${options.method} ${options.url}; waiting ${retryAfter}s`)
    return retryCount < 1
  },
}

/**
 * The handlers have to be baked into the class, not passed to the App.
 *
 * ── The bug this is a fix for ─────────────────────────────────────────────
 * They were passed as `throttle` to `new App({...})`. @octokit/app does not
 * forward that to the Octokit instances it builds, so every installation
 * client was constructed without them — and plugin-throttling refuses to be
 * constructed without them, by design: it throws "You must pass the
 * onSecondaryRateLimit and onRateLimit error handlers".
 *
 * That threw inside getInstallationOctokit, which is the first line of
 * scanRepo. So every scan of every repository failed at the first step from
 * the moment rate limiting was added, and a rescan that appeared to complete
 * had in fact done nothing at all — which is exactly the symptom I spent
 * three rounds attributing to the retraction rules.
 *
 * .defaults() is the fix because it sets them on the class, so every
 * instance carries them however it was constructed and by whom.
 */
const Octokit = RestOctokit.plugin(throttling, retry).defaults({
  throttle: THROTTLE,
})

function readPrivateKey(): string {
  const raw = process.env.GITHUB_APP_PRIVATE_KEY
  if (!raw) throw new Error('Missing GITHUB_APP_PRIVATE_KEY.')
  // Already a real multi-line PEM (e.g. loaded from a file or a platform
  // that supports newlines in env vars) — use as-is. Otherwise unescape.
  return raw.includes('\n') ? raw : raw.replace(/\\n/g, '\n')
}

// @octokit/app's default Octokit is the bare @octokit/core client — request()
// and graphql() only, no .rest.* namespace. Passing @octokit/rest's Octokit
// class here (which already bundles the REST endpoint methods plugin) is
// what makes octokit.rest.apps.getInstallation(), etc. exist on the client
// getInstallationOctokit() below returns.
type WorkmarkApp = App<{ Octokit: typeof Octokit }>

let cachedApp: WorkmarkApp | null = null

/** The GitHub App itself — authenticated as the App, not as any installation. */
export function getGithubApp(): WorkmarkApp {
  if (cachedApp) return cachedApp

  const appId = process.env.GITHUB_APP_ID
  const webhookSecret = process.env.GITHUB_APP_WEBHOOK_SECRET
  if (!appId) throw new Error('Missing GITHUB_APP_ID.')
  if (!webhookSecret) throw new Error('Missing GITHUB_APP_WEBHOOK_SECRET.')

  cachedApp = new App({
    appId,
    privateKey: readPrivateKey(),
    webhooks: { secret: webhookSecret },
    Octokit,
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
