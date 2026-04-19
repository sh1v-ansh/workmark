'use client'

import { MarketingLayout } from './landing/MarketingLayout'
import { Hero } from './landing/Hero'
import { TheProblem } from './landing/TheProblem'
import { TheStat } from './landing/TheStat'
import { WhoItFor } from './landing/WhoItFor'
import { JoinSection } from './landing/WaitlistSection'
import { C, F } from './landing/tokens'

export default function LandingPage() {
  return (
    <MarketingLayout>
      <Hero />

      {/* Key insight */}
      <section style={{ borderTop: `1px solid ${C.border}`, padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div className="reveal-item" style={{ maxWidth: 800 }}>
          <div style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20 }}>
            The key insight
          </div>
          <p style={{ fontFamily: F.serif, fontSize: 44, lineHeight: 1.2, color: C.text, fontWeight: 700, marginBottom: 20 }}>
            Workmark makes experience grindable.
          </p>
          <p style={{ fontSize: 18, lineHeight: 1.7, color: C.textMuted, maxWidth: 580 }}>
            Do the work, build the record, unlock better opportunities. It replaces the self-reported résumé with verified proof.
          </p>
        </div>
      </section>

      <TheProblem />
      <TheStat />
      <WhoItFor />
      <JoinSection />
    </MarketingLayout>
  )
}
