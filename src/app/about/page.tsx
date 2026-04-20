import type { Metadata } from 'next'
import { MarketingLayout } from '../landing/MarketingLayout'
import { TeamSection } from '../landing/TeamSection'
import { C, F } from '../landing/tokens'

export const metadata: Metadata = {
  title: 'About — Workmark',
  description: 'Workmark is built by a UMass CS student to fix the broken credential system for early-career developers.',
}

export default function AboutPage() {
  return (
    <MarketingLayout>
      {/* Page header */}
      <section style={{ borderBottom: `1px solid ${C.border}`, padding: '64px 24px 48px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
          About
        </div>
        <h1 style={{ fontFamily: F.serif, fontSize: 48, fontWeight: 800, letterSpacing: '-0.03em', color: C.text, lineHeight: 1.1, maxWidth: 560 }}>
          One person trying to fix a broken system.
        </h1>
      </section>

      <TeamSection />
    </MarketingLayout>
  )
}
