'use client'

import { useReveal } from './useReveal'
import { Nav } from './Nav'
import { Footer } from './Footer'
import { C } from './tokens'

export function MarketingLayout({ children }: { children: React.ReactNode }) {
  useReveal()

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh', overflowX: 'hidden' }}>
      {/* Grain overlay — decorative, hidden from assistive technology */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, zIndex: 999, pointerEvents: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          opacity: 0.035,
        }}
      />

      <Nav />
      {/* id targets the skip-to-content link in layout.tsx */}
      <main id="main-content" style={{ paddingTop: 64 }}>
        {children}
      </main>
      <Footer />
    </div>
  )
}
