import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enforce } from '@/lib/rate-limit'
import { clientIp } from '@/lib/http/request-ip'
import { readJsonBody, requireEmail, ValidationError } from '@/lib/http/validate'

/**
 * POST /api/auth/resend
 *
 * The most abusable button on the site, and the one that was least
 * protected: it sends an email, to an address the caller chooses, at
 * Workmark's expense, and it was called straight from the browser with only
 * a thirty-second countdown in front of it. A countdown in a page is a
 * courtesy to the person clicking, not a control on anyone who isn't.
 *
 * Four an hour per address. Beyond that it is not somebody who lost an
 * email.
 *
 * Always answers as if it worked. Whether an address has a pending signup is
 * exactly the fact an enumeration attack is fishing for, and a resend
 * endpoint that distinguishes "sent" from "no such account" hands it over
 * for free.
 */
export async function POST(request: Request) {
  const ip = clientIp(request)

  try {
    const body = await readJsonBody(request)
    const email = requireEmail(body.email)

    const limited = await enforce('authResend', ip)
    if (limited) return limited

    const supabase = await createClient()
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${
          process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? new URL(request.url).origin
        }/auth/confirmed`,
      },
    })

    // Logged, not surfaced. An operator needs to know the mail provider is
    // refusing; the caller must not learn anything about the address.
    if (error) console.error('[auth/resend] supabase refused:', error.message)

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[auth/resend] failed:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
