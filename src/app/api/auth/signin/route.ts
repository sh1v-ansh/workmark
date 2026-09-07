import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enforce } from '@/lib/rate-limit'
import { clientIp } from '@/lib/http/request-ip'
import { destinationAfterSignIn } from '@/lib/auth/post-signin'
import {
  readJsonBody,
  requireEmail,
  requireString,
  MAX_EMAIL_LENGTH,
  ValidationError,
} from '@/lib/http/validate'

/**
 * POST /api/auth/signin
 *
 * The counterpart to the signup route, and here for one reason above the
 * others: password guessing.
 *
 * Two limits, because they stop different attacks and neither substitutes
 * for the other. The per-address limit stops one machine working through a
 * list. The per-account limit stops the same list being worked through from
 * a thousand rented addresses at one attempt each, which is what credential
 * stuffing actually looks like and which a per-IP limit never sees.
 *
 * The account limit is checked second, deliberately. Both are fixed windows,
 * so an attempt only counts once against each — but spending the scarcer
 * budget last means a flood from one address burns its own quota before it
 * can burn the quota belonging to the account it is aiming at. Otherwise
 * anyone could lock a known user out by failing eight times on their behalf.
 */
export async function POST(request: Request) {
  const ip = clientIp(request)

  try {
    const body = await readJsonBody(request)
    const email = requireEmail(body.email)

    // No minimum. A length rule on sign-in tells an attacker the shape of
    // what they are looking for, and the only correct answer to a wrong
    // password is that it was wrong.
    const password = requireString(body.password, 'Password', { max: 512, trim: false })

    const byAddress = await enforce('authSignin', ip)
    if (byAddress) return byAddress

    const byAccount = await enforce('authSigninEmail', email.slice(0, MAX_EMAIL_LENGTH))
    if (byAccount) return byAccount

    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      const reason = error.message.toLowerCase()
      if (reason.includes('email not confirmed')) {
        return NextResponse.json(
          {
            error: 'Please confirm your email address before signing in. Check your inbox for the confirmation link.',
            needsConfirmation: true,
          },
          { status: 401 },
        )
      }
      // Everything else collapses to one message. "No such account" and
      // "wrong password" are the same event as far as the person typing is
      // concerned, and telling them apart is how an attacker turns a
      // password guess into a list of real addresses.
      return NextResponse.json(
        { error: 'Invalid email or password. Please try again.' },
        { status: 401 },
      )
    }

    // signInWithPassword wrote the session cookies through the ssr adapter,
    // so the browser is signed in from here on and every read below is done
    // as them rather than as the anon role.
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication failed.' }, { status: 401 })
    }

    const [{ data: account }, { data: student }] = await Promise.all([
      supabase.from('accounts').select('roles, status').eq('id', user.id).maybeSingle(),
      supabase.from('students').select('id').eq('id', user.id).maybeSingle(),
    ])

    // Answered here rather than by the page, because the server already has
    // both rows — and because the same rule in two places is how faculty
    // ended up at a student dashboard once before.
    return NextResponse.json({
      ok: true,
      redirectTo: destinationAfterSignIn({
        hasAccount: !!account,
        status: (account?.status as string | undefined) ?? null,
        roles: (account?.roles ?? []) as string[],
        hasStudentProfile: !!student,
      }),
    })
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[auth/signin] failed:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
