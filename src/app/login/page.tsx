'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Mode = 'signin' | 'signup'
type Role = 'student' | 'company'

export default function LoginPage() {
  const router = useRouter()

  const [mode, setMode] = useState<Mode>('signin')
  const [role, setRole] = useState<Role>('student')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Set to the submitted email after a successful sign-up to show the
  // "check your inbox" screen.
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
        if (role === 'student' && !validateEdu(email)) {
          setError(
            'Workmark is for students only — please sign up with your university (.edu) email.'
          )
          return
        }

        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { role },
            emailRedirectTo: `${window.location.origin}/login`,
          },
        })

        if (signUpError) throw signUpError

        // Don't redirect yet — user must confirm their email first.
        setPendingConfirmEmail(email)
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (signInError) {
          if (
            signInError.message.toLowerCase().includes('invalid') ||
            signInError.message.toLowerCase().includes('credentials')
          ) {
            throw new Error('Invalid email or password. Please try again.')
          }
          if (signInError.message.toLowerCase().includes('email not confirmed')) {
            throw new Error(
              'Please confirm your email address before signing in. Check your inbox for the confirmation link.'
            )
          }
          throw signInError
        }

        // Detect role from DB and redirect
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) throw new Error('Authentication failed.')

        const { data: student } = await supabase
          .from('students')
          .select('id')
          .eq('id', user.id)
          .maybeSingle()

        if (student) {
          router.push('/student/dashboard')
          router.refresh()
          return
        }

        const { data: company } = await supabase
          .from('companies')
          .select('id')
          .eq('id', user.id)
          .maybeSingle()

        if (company) {
          router.push('/company/dashboard')
          router.refresh()
          return
        }

        router.push('/onboarding')
        router.refresh()
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  // ── Post sign-up: waiting for email confirmation ──────────────────────────
  if (pendingConfirmEmail) {
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <Link href="/" aria-label="Workmark home" className="mb-8">
          <span className="text-2xl font-bold tracking-tight text-gray-900" aria-hidden="true">
            Work<span className="text-brand-600">mark</span>
          </span>
        </Link>

        <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-4" aria-hidden="true">
            <svg className="w-7 h-7 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          <h1 className="text-lg font-bold text-gray-900 mb-2">
            Check your inbox
          </h1>
          <p className="text-sm text-gray-500 mb-1">
            We sent a confirmation link to
          </p>
          <p className="text-sm font-semibold text-gray-800 mb-4 break-all">
            {pendingConfirmEmail}
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Click the link in that email to activate your account, then come
            back here and sign in.
          </p>

          <button
            onClick={() => {
              setPendingConfirmEmail(null)
              setMode('signin')
              setPassword('')
            }}
            className="w-full py-2.5 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700 transition-colors"
          >
            Go to sign in
          </button>

          <p className="text-xs text-gray-400 mt-4">
            Can&apos;t find the email? Check your spam folder.
          </p>
        </div>
      </main>
    )
  }

  // ── Normal sign in / sign up form ─────────────────────────────────────────
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <Link href="/" aria-label="Workmark home" className="mb-8">
        <span className="text-2xl font-bold tracking-tight text-gray-900" aria-hidden="true">
          Work<span className="text-brand-600">mark</span>
        </span>
      </Link>

      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          {/* Mode tabs */}
          <div className="flex rounded-xl bg-gray-100 p-1 mb-6" role="group" aria-label="Sign in or sign up">
            {(['signin', 'signup'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null) }}
                aria-pressed={mode === m}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  mode === m
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {m === 'signin' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role selector (sign-up only) */}
            {mode === 'signup' && (
              <div>
                <p id="role-label" className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  I am a
                </p>
                <div className="flex gap-2" role="group" aria-labelledby="role-label">
                  {(['student', 'company'] as Role[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => { setRole(r); setError(null); setEmail('') }}
                      aria-pressed={role === r}
                      className={`flex-1 py-2.5 text-sm font-medium rounded-xl border transition-colors capitalize ${
                        role === r
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {r === 'student' ? '🎓 Student' : '🏢 Company'}
                    </button>
                  ))}
                </div>
                {role === 'student' && (
                  <p className="text-xs text-gray-400 mt-2">
                    Students must use a university <strong>.edu</strong> email address.
                  </p>
                )}
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null) }}
                placeholder={mode === 'signup' && role === 'student' ? 'you@university.edu' : 'you@example.com'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input
                id="login-password"
                type="password"
                required
                minLength={8}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'Min. 8 characters' : '••••••••'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
              />
            </div>

            {/* Error */}
            {error && (
              <div role="alert" className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 animate-fade-in">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                  <span>{mode === 'signin' ? 'Signing in…' : 'Creating account…'}</span>
                </span>
              ) : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-400 mt-4">
          <Link href="/projects" className="hover:text-brand-600 transition-colors">
            Browse open projects →
          </Link>
        </p>
      </div>
    </main>
  )
}
