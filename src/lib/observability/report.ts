// Somewhere for errors to go.
//
// Until this existed, a production 500 was invisible unless a user thought
// to mention it. console.error goes to Vercel's log stream, which is
// searchable for a few hours and nobody watches.
//
// This writes to Postgres and surfaces in /admin/errors. That is a smaller
// tool than Sentry — no stack-trace symbolication, no alerting, no release
// tracking — and it was chosen anyway, because error payloads on this
// platform routinely contain a student's private repository names and their
// skill data. Sending those to another processor is a privacy-policy
// change, not a config change. When there's a reason to add Sentry, this
// module is the one place that changes.

import { createClient as createServiceClient } from '@supabase/supabase-js'

interface ReportArgs {
  /** Where it happened: a route path or component name. Used for grouping. */
  context: string
  error: unknown
  userId?: string | null
  pageUrl?: string | null
  userAgent?: string | null
  source?: 'server' | 'client'
}

function describe(error: unknown): { message: string; stack: string | null } {
  if (error instanceof Error) return { message: error.message, stack: error.stack ?? null }
  if (typeof error === 'string') return { message: error, stack: null }
  try {
    return { message: JSON.stringify(error), stack: null }
  } catch {
    return { message: String(error), stack: null }
  }
}

/**
 * Record an error. Never throws.
 *
 * An error reporter that can fail the request it's reporting on is worse
 * than no error reporter — it converts a handled problem into an unhandled
 * one. Everything here is caught, and console.error still happens
 * regardless so the Vercel log keeps working if the database write doesn't.
 */
export async function reportError(args: ReportArgs): Promise<void> {
  const { message, stack } = describe(args.error)
  console.error(`[${args.context}]`, args.error)

  try {
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    await admin.rpc('record_error', {
      p_source: args.source ?? 'server',
      p_context: args.context,
      p_message: message,
      p_stack: stack,
      p_user_id: args.userId ?? null,
      p_page_url: args.pageUrl ?? null,
      p_user_agent: args.userAgent ?? null,
    })
  } catch (err) {
    // Deliberately swallowed after logging. If the error log is down, the
    // request still has to complete.
    console.error('[observability] could not record error:', err)
  }
}

/**
 * Wrap a route handler so anything it throws is recorded rather than
 * becoming an opaque 500.
 *
 * Used on the routes where a silent failure is most expensive — the ones
 * that spend money, write to a student's record, or talk to GitHub.
 */
export function withErrorReporting<T extends unknown[]>(
  context: string,
  handler: (...args: T) => Promise<Response>,
): (...args: T) => Promise<Response> {
  return async (...args: T) => {
    try {
      return await handler(...args)
    } catch (error) {
      const request = args[0] as Request | undefined
      await reportError({
        context,
        error,
        pageUrl: request?.url ?? null,
        userAgent: request?.headers?.get('user-agent') ?? null,
      })
      return new Response(
        JSON.stringify({ error: 'Something went wrong on our end.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      )
    }
  }
}
