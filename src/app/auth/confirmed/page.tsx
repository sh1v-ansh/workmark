import Link from 'next/link'
import type { Metadata } from 'next'
import { Wordmark } from '@/app/landing/Wordmark'
import Button from '@/components/ui/Button'
import { C, F } from '@/lib/theme/dark-tokens'

export const metadata: Metadata = {
  title: 'Confirmed',
}

/**
 * Where the verification email lands. One job: tell them it worked and get
 * them signed in to finish setting up.
 */
export default function ConfirmedPage() {
  return (
    <main
      className="wm-app-ground"
      style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <Link href="/" aria-label="Workmark home" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', marginBottom: 32 }}>
        <Wordmark height={26} />
      </Link>

      <div className="nb-card" style={{ width: '100%', maxWidth: 420, padding: '36px 32px', textAlign: 'center' }}>
        <div
          aria-hidden="true"
          style={{
            width: 56, height: 56, borderRadius: 999, margin: '0 auto 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(145deg, #EEE9FF 0%, #F7F5FF 100%)',
            boxShadow: 'inset 0 0 0 1px rgba(97,66,245,0.2)',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
            <path d="M4 10.5l4 4 8-8" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h1 style={{ fontFamily: F.display, fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: C.text, marginBottom: 8 }}>
          You&apos;re verified
        </h1>
        <p style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.6, marginBottom: 26 }}>
          Your email is confirmed. Sign in to finish setting up your profile.
        </p>

        <Button href="/login" variant="accent" fullWidth>Sign in</Button>
      </div>
    </main>
  )
}
