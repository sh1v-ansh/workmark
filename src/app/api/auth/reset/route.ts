import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enforce } from '@/lib/rate-limit'
import { clientIp } from '@/lib/http/request-ip'
import { readJsonBody, requireEmail, ValidationError } from '@/lib/http/validate'

function siteUrl(request: Request): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? new URL(request.url).origin
}

/**
 * POST /api/auth/reset — send somebody a link to choose a new password.
 *
 * ── Why this had to exist before launch ───────────────────────────────────
 * Workmark signs people in with a password and had no way to recover one.
 * The first person to forget theirs was locked out permanently, and the only
 * fix was an operator editing them by hand in the Supabase dashboard.
 *
 * ── Why the answer is always the same ─────────────────────────────────────
 * "No account with that address" is precisely the fact an enumeration attack
 * is fishing for, and a reset endpoint is the easiest place in any product
 * to ask it a few thousand times. So this returns ok whether the address
 * exists or not, exactly as /api/auth/resend does. The person who really
 * forgot their password gets an email; the person testing a leaked address
 * list learns nothing.
 *
 * ── The rate limit is not optional ────────────────────────────────────────
 * Like resend, this sends mail to an address the caller chooses at
 * Workmark's expense. Uncounted, it is a mail bomb with a form in front of
 * it — and a young sending domain does not survive being used as one.
 */
export async function POST(request: Request) {
  const ip = clientIp(request)

  try {
    const body = await readJsonBody(request)
    const email = requireEmail(body.email)

    const limited = await enforce('authReset', ip)
    if (limited) return limited

    const supabase = await createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // Through the callback rather than straight at the form. The link
      // carries a PKCE code that has to be exchanged for a session before
      // updateUser can do anything, and only a route handler can write the
      // session cookie — a server component cannot. See auth/callback.
      redirectTo: `${siteUrl(request)}/auth/callback?next=/auth/reset`,
    })

    // Logged, never surfaced. An operator needs to know when the mail
    // provider is refusing; the caller must not learn anything at all.
    if (error) console.error('[auth/reset] supabase refused:', error.message)

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[auth/reset] failed:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
