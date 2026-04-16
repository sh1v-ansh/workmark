'use client'

import { useReveal } from './landing/useReveal'
import { Nav } from './landing/Nav'
import { Hero } from './landing/Hero'
import { HowItWorks } from './landing/HowItWorks'
import { VerificationSection } from './landing/VerificationSection'
import { EngagementTypes } from './landing/EngagementTypes'
import { TheStat } from './landing/TheStat'
import { WhoItFor } from './landing/WhoItFor'
import { WaitlistSection } from './landing/WaitlistSection'
import { Footer } from './landing/Footer'
import { C } from './landing/tokens'

export default function LandingPage() {
  useReveal()

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh', overflowX: 'hidden' }}>
      {/* Grain overlay */}
      <div
        aria-hidden
        style={{
          position: 'fixed', inset: 0, zIndex: 999, pointerEvents: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          opacity: 0.035,
        }}
      />

      <style>{`html { scroll-behavior: smooth; }`}</style>

      <Nav />

      <main>
        <Hero />

        <section style={{ borderTop: `1px solid ${C.border}`, padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
          <div className="reveal-item" style={{ maxWidth: 680 }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#6b6760', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>The key insight</div>
            <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 36, lineHeight: 1.35, color: C.text, fontWeight: 500, marginBottom: 20 }}>
              Workmark makes experience grindable.
            </p>
            <p style={{ fontSize: 17, lineHeight: 1.7, color: '#9e9a8e', maxWidth: 560 }}>
              Do the work, build the record, unlock better opportunities. It replaces the self-reported résumé with verified proof.
            </p>
          </div>
        </section>

        <HowItWorks />
        <VerificationSection />
        <EngagementTypes />
        <TheStat />
        <WhoItFor />
        <WaitlistSection />
        <Footer />
      </main>
    </div>
  )
}
