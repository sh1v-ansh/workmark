'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import { C, F } from '@/lib/theme/dark-tokens'
import { Wordmark } from '@/app/landing/Wordmark'

type Mode = 'signin' | 'signup'
// Student-only in MVP: company/faculty accounts are deferred to Tier 1+
// and have no table in the v0.5 schema to write a profile into.
type Role = 'student'

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

  const inputStyle: React.CSSProperties = {
    background: C.surfaceAlt,
    border: `1px solid ${C.border}`,
    color: C.text,
    fontSize: 14,
    padding: '10px 14px',
    outline: 'none',
    width: '100%',
    fontFamily: F.sans,
    transition: 'border-color 0.15s',
  }

  if (pendingConfirmEmail) {
    return (
      <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Link href="/" aria-label="Workmark home" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 40 }}>
          <Wordmark height={26} />
        </Link>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 40, width: '100%', maxWidth: 380, textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, background: C.accentHover, border: `1px solid ${C.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }} aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
              <rect x="2" y="4" width="16" height="12" rx="0.5" stroke={C.accent} strokeWidth="1.2" />
              <path d="M2 5.5l8 5 8-5" stroke={C.accent} strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </div>
          <h1 style={{ fontFamily: F.mono, fontSize: 16, fontWeight: 500, color: C.text, marginBottom: 12 }}>Check your inbox</h1>
          <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 6, lineHeight: 1.6 }}>We sent a confirmation link to</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 12, wordBreak: 'break-all', fontFamily: F.mono }}>{pendingConfirmEmail}</p>
          <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6, marginBottom: 24 }}>
            Click the link in that email to activate your account, then come back here and sign in.
          </p>
          <button
            onClick={() => { setPendingConfirmEmail(null); setMode('signin'); setPassword('') }}
            style={{ width: '100%', padding: '11px 0', background: C.accent, color: C.bg, fontFamily: F.mono, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', letterSpacing: '0.04em' }}
          >
            Go to sign in
          </button>
          <button
            onClick={handleResend}
            disabled={resending || resendCooldown > 0}
            style={{
              width: '100%', padding: '11px 0', marginTop: 10, background: 'transparent',
              color: resending || resendCooldown > 0 ? C.textFaint : C.textMuted,
              fontFamily: F.mono, fontSize: 12, fontWeight: 500,
              border: `1px solid ${C.border}`, cursor: resending || resendCooldown > 0 ? 'not-allowed' : 'pointer',
              letterSpacing: '0.04em',
            }}
          >
            {resending ? 'Resending…' : resendCooldown > 0 ? `Resend confirmation email (${resendCooldown}s)` : 'Resend confirmation email'}
          </button>
          <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono, marginTop: 16 }}>Can&apos;t find it? Check your spam folder.</p>
        </div>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Link href="/" aria-label="Workmark home" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 40 }}>
        <Wordmark height={26} />
      </Link>

      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 32 }}>
          {/* Mode tabs */}
          <div role="group" aria-label="Sign in or sign up" style={{ display: 'flex', gap: 0, marginBottom: 28, background: C.bg, border: `1px solid ${C.border}`, padding: 3 }}>
            {(['signin', 'signup'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null) }}
                aria-pressed={mode === m}
                style={{
                  flex: 1, padding: '8px 0', fontFamily: F.mono, fontSize: 12, border: 'none', cursor: 'pointer',
                  background: mode === m ? C.surface : 'transparent',
                  color: mode === m ? C.text : C.textMuted,
                  letterSpacing: '0.04em',
                  transition: 'all 0.15s',
                }}
              >
                {m === 'signin' ? 'SIGN IN' : 'SIGN UP'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {mode === 'signup' && (
              <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono, lineHeight: 1.5 }}>
                Requires a university <strong style={{ color: C.textMuted }}>.edu</strong> email address.
              </p>
            )}

            <div>
              <label htmlFor="login-email" style={{ display: 'block', fontFamily: F.mono, fontSize: 10, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Email</label>
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
              <label htmlFor="login-password" style={{ display: 'block', fontFamily: F.mono, fontSize: 10, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Password</label>
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
              <div role="alert" style={{ background: 'rgba(180,40,40,0.12)', border: '1px solid rgba(180,40,40,0.35)', padding: '10px 14px', fontSize: 13, color: '#DC2626', fontFamily: F.sans, lineHeight: 1.5 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '11px 0', background: loading ? C.surfaceAlt : C.accent,
                color: loading ? C.textMuted : C.bg,
                fontFamily: F.mono, fontSize: 13, fontWeight: 500, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                letterSpacing: '0.06em', textTransform: 'uppercase', transition: 'all 0.2s', marginTop: 4,
              }}
            >
              {loading
                ? (mode === 'signin' ? 'Signing in…' : 'Creating account…')
                : (mode === 'signin' ? 'Sign in →' : 'Create account →')}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: C.textFaint, fontFamily: F.mono, marginTop: 16 }}>
          <Link href="/listings" style={{ color: C.textMuted, textDecoration: 'none' }}>
            Browse open projects →
          </Link>
        </p>
      </div>
    </main>
  )
}
