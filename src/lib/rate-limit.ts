// How often one person may do one thing.
//
// Nothing was limited before this. The routes that call Anthropic cost real
// money on every request and were reachable by anyone with a session; the
// scan routes spend the GitHub App's rate limit, which is shared across
// every user on the platform, so one person hammering refresh degrades
// everybody else's scans.
//
// Fixed windows, counted in Postgres. A sliding window is more accurate at
// the boundary and needs a row per request; this needs one row per (person,
// action) that gets overwritten in place. At this size the accuracy
// difference is irrelevant and the write-volume difference is not — which
// matters, because a rate limiter that adds meaningful database load is
// solving one problem by causing another.

import { createClient as createServiceClient } from '@supabase/supabase-js'

export interface LimitResult {
  allowed: boolean
  remaining: number
  /** When the window rolls over. */
  resetAt: Date | null
  /** Seconds until then — what goes in the Retry-After header. */
  retryAfter: number
}

/**
 * The limits, in one place so they can be read as a set.
 *
 * The numbers come from what a real person plausibly does in the window,
 * roughly doubled. A limit tuned so tightly that ordinary use trips it
 * becomes a bug report, and then gets removed.
 */
export const LIMITS = {
  /** Anthropic calls. Each one costs money; nobody needs six an hour. */
  agent: { limit: 12, windowSeconds: 3600 },
  /** A full GitHub scan. Slow, and spends a shared rate limit. */
  scan: { limit: 6, windowSeconds: 3600 },
  /** Applications. There's a hard cap on active ones anyway; this stops churn. */
  apply: { limit: 20, windowSeconds: 3600 },
  /** Bug reports and feature requests. */
  feedback: { limit: 10, windowSeconds: 3600 },
  /** Account creation from one session. */
  onboarding: { limit: 5, windowSeconds: 3600 },
  /** Editing your own profile. Looser than onboarding on purpose: someone
   *  fixing a typo, then their major, then their graduation year has done
   *  nothing wrong, and five an hour would tell them they had. */
  profile: { limit: 30, windowSeconds: 3600 },
  /** The data export. Assembles seventeen queries; not a page to refresh. */
  export: { limit: 5, windowSeconds: 3600 },

  /** Creating projects and inviting people. Generous — a student setting up
   *  a project and getting three teammates in does a lot in five minutes. */
  workspace: { limit: 40, windowSeconds: 3600 },

  // ── Before anyone is signed in ──
  // These four are keyed on an IP or an email address rather than a user id,
  // because the whole point is that no user exists yet. Everything above
  // sits behind a session, so an attacker has to get through these first —
  // which is exactly why there was a hole here: the sign-in form posted
  // straight to Supabase from the browser and never touched a Workmark
  // route that could count it.

  /** New accounts from one address. A real person makes one, maybe two. */
  authSignup: { limit: 5, windowSeconds: 3600 },
  /** Sign-in attempts from one address. Fat fingers, a forgotten password,
   *  then a password manager — fifteen covers all of it and stops nothing
   *  a person would actually do. */
  authSignin: { limit: 15, windowSeconds: 900 },
  /** Attempts against ONE account, counted across every address they come
   *  from. The per-IP limit above does nothing against credential stuffing
   *  spread over a proxy pool; this is the limit that does. */
  authSigninEmail: { limit: 8, windowSeconds: 900 },
  /** Resending a confirmation email. Each one is a message Workmark pays to
   *  send to an address chosen by whoever asked, which is the definition of
   *  a mail bomb if nothing counts them. */
  authResend: { limit: 4, windowSeconds: 3600 },
} as const

export type LimitName = keyof typeof LIMITS

/**
 * Count one request against a limit.
 *
 * Fails open. If the limiter itself is broken, requests go through — the
 * alternative is a database hiccup taking the whole application offline,
 * which is a far worse outcome than a window of unlimited requests.
 */
export async function checkRateLimit(args: {
  key: string
  limit: number
  windowSeconds: number
}): Promise<LimitResult> {
  try {
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data, error } = await admin.rpc('check_rate_limit', {
      p_key: args.key,
      p_limit: args.limit,
      p_window_seconds: args.windowSeconds,
    })

    if (error || !data || data.length === 0) {
      if (error) console.error('[rate-limit] check failed, allowing:', error)
      return { allowed: true, remaining: args.limit, resetAt: null, retryAfter: 0 }
    }

    const row = data[0] as { allowed: boolean; remaining: number; reset_at: string }
    const resetAt = new Date(row.reset_at)
    return {
      allowed: row.allowed,
      remaining: row.remaining,
      resetAt,
      retryAfter: Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000)),
    }
  } catch (err) {
    console.error('[rate-limit] check threw, allowing:', err)
    return { allowed: true, remaining: args.limit, resetAt: null, retryAfter: 0 }
  }
}

/**
 * Apply a named limit to one subject, and return a ready 429 if they're over.
 *
 * The subject is a user id nearly everywhere, and an IP address or an email
 * for the four pre-auth limits — the key is built the same way either way,
 * so nothing here needed to change to support them. It is named `subject`
 * rather than `userId` only so the next person reading it doesn't assume a
 * session exists.
 *
 * Returning the Response rather than throwing keeps the call site a two-line
 * early return, which is the shape that actually gets added to new routes.
 */
export async function enforce(
  name: LimitName,
  subject: string,
): Promise<Response | null> {
  const { limit, windowSeconds } = LIMITS[name]
  const result = await checkRateLimit({ key: `${name}:${subject}`, limit, windowSeconds })
  if (result.allowed) return null

  const minutes = Math.ceil(result.retryAfter / 60)
  return new Response(
    JSON.stringify({
      error: minutes > 1
        ? `You've done that a lot in a short time. Try again in about ${minutes} minutes.`
        : 'You\'ve done that a lot in a short time. Try again in a minute.',
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(result.retryAfter),
      },
    },
  )
}
