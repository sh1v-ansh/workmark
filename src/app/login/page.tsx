'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { C, F } from '@/app/landing/tokens'
import { LogoMark } from '@/app/landing/LogoMark'

type Mode = 'signin' | 'signup'
type Role = 'student' | 'company' | 'faculty'

export default function LoginPage() {
  const router = useRouter()

  const [mode, setMode] = useState<Mode>('signin')
  const [role, setRole] = useState<Role>('student')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingConfirmEmail, setPendingConfirmEmail] = useState<string | null>(null)

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
        if ((role === 'student' || role === 'faculty') && !validateEdu(email)) {
          setError(`${role === 'faculty' ? 'Faculty' : 'Student'} accounts require a university (.edu) email address.`)
          return
        }
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { role },
            emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/auth/confirmed`,
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
        if (student) { router.push('/student/dashboard'); router.refresh(); return }
        const { data: company } = await supabase.from('companies').select('id').eq('id', user.id).maybeSingle()
        if (company) { router.push('/company/dashboard'); router.refresh(); return }
        const { data: faculty } = await supabase.from('faculty').select('id').eq('id', user.id).maybeSingle()
        if (faculty) { router.push('/faculty/dashboard'); router.refresh(); return }
        router.push('/onboarding'); router.refresh()
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
          <LogoMark size={22} />
          <span style={{ fontFamily: F.mono, fontSize: 16, fontWeight: 500, color: C.text, letterSpacing: '-0.02em' }} aria-hidden="true">workmark</span>
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
          <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono, marginTop: 16 }}>Can&apos;t find it? Check your spam folder.</p>
        </div>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Link href="/" aria-label="Workmark home" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 40 }}>
        <LogoMark size={22} />
        <span style={{ fontFamily: F.mono, fontSize: 16, fontWeight: 500, color: C.text, letterSpacing: '-0.02em' }} aria-hidden="true">workmark</span>
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
            {/* Role selector — sign-up only */}
            {mode === 'signup' && (
              <div>
                <p id="role-label" style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>I am a</p>
                <div role="group" aria-labelledby="role-label" style={{ display: 'flex', gap: 8 }}>
                  {([
                    { r: 'student', label: 'Student' },
                    { r: 'company', label: 'Company' },
                    { r: 'faculty', label: 'Faculty' },
                  ] as { r: Role; label: string }[]).map(({ r, label }) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => { setRole(r); setError(null); setEmail('') }}
                      aria-pressed={role === r}
                      style={{
                        flex: 1, padding: '10px 0', fontFamily: F.mono, fontSize: 11, border: `1px solid ${role === r ? C.accent : C.border}`,
                        background: role === r ? C.accentHover : C.surfaceAlt,
                        color: role === r ? C.accent : C.textMuted,
                        cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em', transition: 'all 0.15s',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {(role === 'student' || role === 'faculty') && (
                  <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono, marginTop: 8 }}>
                    Requires a university <strong style={{ color: C.textMuted }}>.edu</strong> email address.
                  </p>
                )}
              </div>
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
                placeholder={mode === 'signup' && (role === 'student' || role === 'faculty') ? 'you@university.edu' : 'you@example.com'}
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
              <div role="alert" style={{ background: 'rgba(180,40,40,0.12)', border: '1px solid rgba(180,40,40,0.35)', padding: '10px 14px', fontSize: 13, color: '#f87171', fontFamily: F.sans, lineHeight: 1.5 }}>
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
          <Link href="/projects" style={{ color: C.textMuted, textDecoration: 'none' }}>
            Browse open projects →
          </Link>
        </p>
      </div>
    </main>
  )
}
