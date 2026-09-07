import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enforce } from '@/lib/rate-limit'
import { clientIp } from '@/lib/http/request-ip'
import {
  readJsonBody,
  requireEmail,
  requireString,
  isEduAddress,
  ValidationError,
} from '@/lib/http/validate'

/**
 * POST /api/auth/signup
 *
 * Sign-up used to happen in the browser: the page called supabase.auth.signUp
 * directly, so no Workmark server ever saw the attempt. Two things followed
 * from that, and both are the reason this route exists.
 *
 * The .edu rule was decoration. It ran in the page, so anyone who opened
 * devtools — or who simply posted to Supabase themselves — could register any
 * address at all. The single rule that makes a Workmark account a *student*
 * account was enforced nowhere a client could not skip.
 *
 * And nothing counted the attempts. Every rate limit in the app is keyed on a
 * user id, which cannot work on the request that creates the user. A script
 * could fire signups at arbitrary addresses for as long as it liked, each one
 * a confirmation email Workmark pays to send to someone who never asked.
 *
 * Sitting in front of Supabase rather than beside it fixes both: the address
 * is checked where the client cannot reach, and the attempt is counted before
 * anything is spent on it.
 */

/** Deliberately generous. Supabase's own floor is 6; this is 8 because the
 *  difference is free to us and not to someone guessing. The ceiling is
 *  bcrypt's 72-byte input limit, beyond which characters are ignored. */
const PASSWORD_MIN = 8
const PASSWORD_MAX = 72

function siteUrl(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  if (configured) return configured
  return new URL(request.url).origin
}

export async function POST(request: Request) {
  const ip = clientIp(request)

  try {
    const body = await readJsonBody(request)

    // A field no human can see and no honest client fills in. Bots that
    // parse the form and complete every input announce themselves here.
    //
    // Answered with success rather than an error, on purpose: a bot told
    // that the honeypot failed learns which field to leave alone next time.
    // A bot told it succeeded goes away satisfied and nothing was sent.
    if (typeof body.website === 'string' && body.website.trim() !== '') {
      return NextResponse.json({ ok: true, confirmationRequired: true })
    }

    const email = requireEmail(body.email)
    const password = requireString(body.password, 'Password', {
      min: PASSWORD_MIN,
      max: PASSWORD_MAX,
      trim: false,
    })

    // Checked before the rate limit is spent, so somebody mistyping their
    // address ten times does not lock themselves out of signing up.
    if (!isEduAddress(email)) {
      return NextResponse.json(
        { error: 'Student accounts require a university (.edu) email address.' },
        { status: 400 },
      )
    }

    const limited = await enforce('authSignup', ip)
    if (limited) return limited

    const supabase = await createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role: 'student' },
        emailRedirectTo: `${siteUrl(request)}/auth/confirmed`,
      },
    })

    if (error) {
      // Supabase already declines to say whether an address is registered,
      // and nothing here should undo that. Its message is passed through
      // because it is written for the person reading it — weak password,
      // malformed address — and none of those reveal an account exists.
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, confirmationRequired: true })
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[auth/signup] failed:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
