'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import Button from '@/components/ui/Button'
import { C, F, R } from '@/lib/theme/dark-tokens'
import { Wordmark } from '@/app/landing/Wordmark'

type Mode = 'signin' | 'signup'
// Student-only in MVP: company/faculty accounts are deferred to Tier 1+
// and have no table in the v0.5 schema to write a profile into.
type Role = 'student'

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: C.textSub, marginBottom: 6 }}>
      {children}
    </label>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [mode, setMode] = useState<Mode>('signin')
  const role: Role = 'student'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingConfirmEmail, setPendingConfirmEmail] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  async function handleResend() {
    if (!pendingConfirmEmail) return
    setResending(true)
    const supabase = createClient()
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: pendingConfirmEmail,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin}/auth/confirmed`,
        },
      })
      if (resendError) throw resendError
      toast('Confirmation email resent.', 'success')
      setResendCooldown(30)
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to resend. Please try again.', 'error')
    } finally {
      setResending(false)
    }
  }

  function validateEdu(addr: string): boolean {
    return addr.toLowerCase().endsWith('.edu')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()

    try {
      if (mode === 'signup') {
        if (!validateEdu(email)) {
          setError('Student accounts require a university (.edu) email address.')
          return
        }
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { role },
            emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin}/auth/confirmed`,
          },
        })
        if (signUpError) throw signUpError
        setPendingConfirmEmail(email)
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) {
          if (signInError.message.toLowerCase().includes('invalid') || signInError.message.toLowerCase().includes('credentials')) {
            throw new Error('Invalid email or password. Please try again.')
          }
          if (signInError.message.toLowerCase().includes('email not confirmed')) {
            throw new Error('Please confirm your email address before signing in. Check your inbox for the confirmation link.')
          }
          throw signInError
        }
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Authentication failed.')
        const { data: student } = await supabase.from('students').select('id').eq('id', user.id).maybeSingle()
        router.push(student ? '/student/dashboard' : '/onboarding')
        router.refresh()
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (pendingConfirmEmail) {
    return (
      <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Link href="/" aria-label="Workmark home" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 32 }}>
          <Wordmark height={22} />
        </Link>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: 30, width: '100%', maxWidth: 380, textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, background: '#EDE9FF', borderRadius: R.md, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px' }} aria-hidden="true">
            <svg width="19" height="19" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
              <rect x="2" y="4" width="16" height="12" rx="1.5" stroke={C.accent} strokeWidth="1.4" />
              <path d="M2 5.5l8 5 8-5" stroke={C.accent} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 style={{ fontFamily: F.display, fontSize: 18, fontWeight: 700, letterSpacing: '-0.015em', color: C.text, marginBottom: 10 }}>Check your inbox</h1>
          <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 5, lineHeight: 1.5 }}>We sent a confirmation link to</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12, wordBreak: 'break-all' }}>{pendingConfirmEmail}</p>
          <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.5, marginBottom: 20 }}>
            Click the link in that email to activate your account, then come back here and sign in.
          </p>
          <Button variant="ink" fullWidth onClick={() => { setPendingConfirmEmail(null); setMode('signin'); setPassword('') }}>
            Go to sign in
          </Button>
          <div style={{ marginTop: 10 }}>
            <Button variant="outline" fullWidth onClick={handleResend} disabled={resending || resendCooldown > 0}>
              {resending ? 'Resending…' : resendCooldown > 0 ? `Resend confirmation email (${resendCooldown}s)` : 'Resend confirmation email'}
            </Button>
          </div>
          <p style={{ fontSize: 12, color: C.textGhost, marginTop: 15 }}>Can&apos;t find it? Check your spam folder.</p>
        </div>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Link href="/" aria-label="Workmark home" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 32 }}>
        <Wordmark height={22} />
      </Link>

      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: 26 }}>
          {/* Mode tabs */}
          <div role="group" aria-label="Sign in or sign up" style={{ display: 'flex', gap: 2, marginBottom: 22, background: C.bg, borderRadius: R.md, padding: 3 }}>
            {(['signin', 'signup'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null) }}
                aria-pressed={mode === m}
                style={{
                  flex: 1, padding: '8px 0', fontSize: 12.5, fontWeight: 600, border: 'none', cursor: 'pointer', borderRadius: R.sm, font: 'inherit',
                  background: mode === m ? C.surface : 'transparent',
                  color: mode === m ? C.text : C.textMuted,
                  boxShadow: mode === m ? '0 1px 2px rgba(25,30,46,0.08)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {m === 'signin' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
            {mode === 'signup' && (
              <p style={{ fontSize: 12.5, color: C.textFaint, lineHeight: 1.45 }}>
                Requires a university <strong style={{ color: C.textMuted }}>.edu</strong> email address.
              </p>
            )}

            <div>
              <FieldLabel htmlFor="login-email">Email</FieldLabel>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null) }}
                placeholder={mode === 'signup' ? 'you@university.edu' : 'you@example.com'}
                className="dk-input"
              />
            </div>

            <div>
              <FieldLabel htmlFor="login-password">Password</FieldLabel>
              <input
                id="login-password"
                type="password"
                required
                minLength={8}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'Min. 8 characters' : '••••••••'}
                className="dk-input"
              />
            </div>

            {error && (
              <div role="alert" style={{ background: '#FCE9E9', borderRadius: R.md, padding: '10px 13px', fontSize: 12.5, color: '#B91C1C', lineHeight: 1.45 }}>
                {error}
              </div>
            )}

            <div style={{ marginTop: 4 }}>
              <Button type="submit" variant="accent" fullWidth disabled={loading} busyLabel={loading ? (mode === 'signin' ? 'Signing in…' : 'Creating account…') : null}>
                {mode === 'signin' ? 'Sign in' : 'Create account'}
              </Button>
            </div>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12.5, color: C.textGhost, marginTop: 15 }}>
          <Link href="/listings" style={{ color: C.textMuted, textDecoration: 'none' }}>
            Browse open projects →
          </Link>
        </p>
      </div>
    </main>
  )
}
