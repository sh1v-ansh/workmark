import Link from 'next/link'
import { C, F } from '@/lib/theme/dark-tokens'
import { Wordmark } from '@/app/landing/Wordmark'

export default function NotFound() {
  return (
    <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
      <Link href="/" aria-label="Workmark home" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', marginBottom: 40 }}>
        <Wordmark height={24} />
      </Link>
      <p style={{ fontFamily: F.mono, fontSize: 12, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
        404
      </p>
      <h1 style={{ fontFamily: F.serif, fontSize: 26, fontWeight: 700, color: C.text, marginBottom: 10 }}>
        Nothing here
      </h1>
      <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6, maxWidth: 380, marginBottom: 28 }}>
        This page doesn&apos;t exist, or a profile that used to live at this address has since changed its handle.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/listings" className="wm-btn wm-btn-primary wm-btn-sm" style={{ display: 'inline-flex' }}>
          Browse projects
        </Link>
        <Link href="/" className="wm-btn wm-btn-secondary wm-btn-sm" style={{ display: 'inline-flex' }}>
          Home
        </Link>
      </div>
    </main>
  )
}
