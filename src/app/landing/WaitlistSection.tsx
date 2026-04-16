'use client'

import { useState } from 'react'
import { C, F } from './tokens'

function isValidEmail(addr: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)
}

export function WaitlistSection() {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'student' | 'organization'>('student')
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.')
      return
    }
    setError('')
    setSubmitted(true)
  }

  const roleBtn = (active: boolean) => ({
    flex: 1,
    padding: '10px 0',
    fontFamily: F.mono,
    fontSize: 13,
    border: `1px solid ${active ? C.accent : C.border}`,
    background: active ? C.accentHover : C.surface,
    color: active ? C.accent : C.textFaint,
    cursor: 'pointer' as const,
    transition: 'all 0.15s',
  })

  return (
    <section id="waitlist" style={{ borderTop: `1px solid ${C.border}`, padding: '100px 24px', textAlign: 'center', background: C.bgDeep, position: 'relative', overflow: 'hidden' }}>
      {/* Radial glow */}
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 800, height: 500, background: 'radial-gradient(ellipse at center, rgba(200,117,51,0.07) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 }} />

      <div className="reveal-item" style={{ maxWidth: 520, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20 }}>
          Early access
        </div>
        <h2 style={{ fontFamily: F.serif, fontSize: 48, fontWeight: 700, color: C.text, lineHeight: 1.1, marginBottom: 16 }}>
          Join the first cohort.
        </h2>
        <p style={{ fontSize: 16, color: C.textMuted, lineHeight: 1.7, marginBottom: 40 }}>
          Launching in New England. Founding students and organizations onboarding now.
        </p>

        {submitted ? (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 32 }}>
            <div style={{ fontFamily: F.mono, fontSize: 12, color: C.accent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>You&apos;re on the list</div>
            <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6 }}>
              We&apos;ll reach out as we open up spots in your region. Watch your inbox.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['student', 'organization'] as const).map(r => (
                <button key={r} type="button" onClick={() => setRole(r)} style={roleBtn(role === r)}>
                  {r === 'student' ? 'Student' : 'Organization'}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                placeholder={role === 'student' ? 'you@university.edu' : 'you@company.com'}
                style={{ flex: 1, padding: '12px 16px', background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontSize: 15, outline: 'none', fontFamily: F.sans }}
                onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                onBlur={e => (e.currentTarget.style.borderColor = C.border)}
              />
              <button type="submit" style={{ padding: '12px 24px', background: C.accent, color: C.bg, border: 'none', fontWeight: 600, fontSize: 15, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Join →
              </button>
            </div>
            {error && <div style={{ marginTop: 8, fontSize: 13, color: C.accent, fontFamily: F.mono, textAlign: 'left' }}>{error}</div>}
          </form>
        )}

        <p style={{ marginTop: 20, fontSize: 12, color: C.textFaint, fontFamily: F.mono }}>
          Students always free · Organizations: free pilot for first 3 projects
        </p>
      </div>
    </section>
  )
}
