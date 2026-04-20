import Link from 'next/link'
import { LogoMark } from '@/app/landing/LogoMark'
import { C, F } from '@/app/landing/tokens'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Email confirmed — Workmark',
}

export default function ConfirmedPage() {
  return (
    <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Link href="/" aria-label="Workmark home" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 48 }}>
        <LogoMark size={20} />
        <span style={{ fontFamily: F.mono, fontSize: 15, fontWeight: 500, color: C.text, letterSpacing: '-0.02em' }}>workmark</span>
      </Link>

      <div style={{ width: '100%', maxWidth: 400, background: C.surface, border: `1px solid ${C.border}`, padding: 40, textAlign: 'center' }}>
        {/* Check icon */}
        <div style={{ width: 48, height: 48, background: C.accentHover, border: `1px solid ${C.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }} aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M4 10.5l4 4 8-8" stroke={C.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h1 style={{ fontFamily: F.mono, fontSize: 16, fontWeight: 500, color: C.text, marginBottom: 12, letterSpacing: '-0.01em' }}>
          Email confirmed
        </h1>
        <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.7, marginBottom: 32 }}>
          Your email address has been verified. Sign in to complete your profile and get started.
        </p>

        <Link
          href="/login"
          style={{ display: 'block', padding: '11px 0', background: C.accent, color: C.bg, fontFamily: F.mono, fontSize: 13, fontWeight: 500, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.06em' }}
        >
          Sign in →
        </Link>
      </div>
    </main>
  )
}
