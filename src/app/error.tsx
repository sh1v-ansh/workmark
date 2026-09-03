'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { C, F } from '@/lib/theme/dark-tokens'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // The digest is what ties this to a server log line — without it a
    // user reporting "it broke" is unactionable, so it's surfaced below
    // as well as logged.
    console.error('[app] unhandled error:', error)

    // And reported, so nobody has to tell us. Fire-and-forget: a reporting
    // failure inside an error boundary must not produce a second error.
    void fetch('/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: `client:${window.location.pathname}`,
        message: error.message,
        stack: error.stack,
        pageUrl: window.location.href,
      }),
      keepalive: true,
    }).catch(() => {})
  }, [error])

  return (
    <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
      <p style={{ fontFamily: F.mono, fontSize: 12, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
        Something broke
      </p>
      <h1 style={{ fontFamily: F.serif, fontSize: 26, fontWeight: 700, color: C.text, marginBottom: 10 }}>
        That didn&apos;t work
      </h1>
      <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6, maxWidth: 400, marginBottom: 24 }}>
        This is our fault, not yours. Nothing you were doing was lost — try again, and if it keeps happening the code below will tell us exactly what went wrong.
      </p>
      {error.digest && (
        <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono, marginBottom: 24 }}>
          {error.digest}
        </p>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={reset} className="wm-btn wm-btn-primary wm-btn-sm" style={{ display: 'inline-flex' }}>
          Try again
        </button>
        <Link href="/student/dashboard" className="wm-btn wm-btn-secondary wm-btn-sm" style={{ display: 'inline-flex' }}>
          Dashboard
        </Link>
      </div>
    </main>
  )
}
