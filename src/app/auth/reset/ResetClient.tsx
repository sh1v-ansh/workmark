'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import { Wordmark } from '@/app/landing/Wordmark'
import { C, R, E } from '@/lib/theme/dark-tokens'
import { PASSWORD_MIN, passwordProblem } from '@/lib/auth/password'

/**
 * Choose a new password.
 *
 * Reached only through the link in a recovery email, which /auth/callback
 * has already exchanged for a session. So the check at the top is not
 * decoration: somebody who opens this URL directly has no recovery session,
 * and letting them type into a form that cannot possibly work is the kind of
 * dead end people report as "the reset is broken".
 */
export default function ResetClient() {
  const router = useRouter()
  const supabase = createClient()

  const [ready, setReady] = useState<'checking' | 'ok' | 'no-session'>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let live = true
    supabase.auth.getUser().then(({ data }) => {
      if (live) setReady(data.user ? 'ok' : 'no-session')
    })
    return () => { live = false }
  }, [supabase])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Checked here as well as by the API, because this call goes straight to
    // Supabase from the browser — there is no Workmark route in front of it
    // to enforce anything.
    const problem = passwordProblem(password)
    if (problem) { setError(problem); return }
    if (password !== confirm) { setError('The two passwords do not match.'); return }

    setBusy(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setBusy(false)

    if (err) {
      setError(err.message)
      return
    }

    setDone(true)
    // Signed out on purpose. Changing a password is the thing somebody does
    // when they think another person has it, and the useful behaviour then
    // is for every other session to stop working — including any the
    // attacker holds. Staying signed in here would be convenient and wrong.
    await supabase.auth.signOut({ scope: 'global' })
    setTimeout(() => router.push('/login'), 2200)
  }

  return (
    <main className="wm-app-ground" style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Link href="/" aria-label="Workmark home" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 40 }}>
        <Wordmark height={24} />
      </Link>

      <div style={{ width: '100%', maxWidth: 400, background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: 29, boxShadow: E.card }}>
        {ready === 'checking' ? (
          <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6 }}>Checking your link…</p>
        ) : ready === 'no-session' ? (
          <>
            <h1 style={{ fontSize: 17, fontWeight: 600, color: C.text, marginBottom: 8 }}>
              This link has expired
            </h1>
            <p style={{ fontSize: 13.5, color: C.textMuted, lineHeight: 1.6, marginBottom: 20 }}>
              Recovery links work once and last an hour. Ask for a new one and it will be
              in your inbox in a minute.
            </p>
            <Button href="/login">Back to sign in</Button>
          </>
        ) : done ? (
          <>
            <h1 style={{ fontSize: 17, fontWeight: 600, color: C.text, marginBottom: 8 }}>
              Password changed
            </h1>
            <p style={{ fontSize: 13.5, color: C.textMuted, lineHeight: 1.6 }}>
              Every device that was signed in has been signed out, including this one.
              Taking you to sign in…
            </p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 17, fontWeight: 600, color: C.text, marginBottom: 8 }}>
              Choose a new password
            </h1>
            <p style={{ fontSize: 13.5, color: C.textMuted, lineHeight: 1.6, marginBottom: 22 }}>
              At least {PASSWORD_MIN} characters. A long ordinary phrase beats a short
              complicated one.
            </p>

            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16.5 }}>
              <div>
                <label htmlFor="new-password" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.textSub, marginBottom: 6.5 }}>
                  New password
                </label>
                <input
                  id="new-password"
                  type="password"
                  required
                  autoFocus
                  minLength={PASSWORD_MIN}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null) }}
                  className="dk-input"
                />
              </div>

              <div>
                <label htmlFor="confirm-password" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.textSub, marginBottom: 6.5 }}>
                  Again, to be sure
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setError(null) }}
                  className="dk-input"
                />
              </div>

              {error && (
                <div role="alert" style={{ background: '#FCE9E9', borderRadius: R.md, padding: '11px 14px', fontSize: 13, color: '#B91C1C', lineHeight: 1.5 }}>
                  {error}
                </div>
              )}

              <Button type="submit" fullWidth busyLabel={busy ? 'Saving…' : null}>
                Set my new password
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  )
}
