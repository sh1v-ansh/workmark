'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { C, F } from './tokens'

function AishaCard() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    // Skip animation for users who prefer reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStep(3)
      return
    }
    const t1 = setTimeout(() => setStep(1), 800)
    const t2 = setTimeout(() => setStep(2), 1500)
    const t3 = setTimeout(() => setStep(3), 2200)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  const anim = (show: boolean) => ({
    opacity: show ? 1 : 0,
    transform: show ? 'translateY(0)' : 'translateY(8px)',
    transition: 'opacity 0.5s ease, transform 0.5s ease',
  })

  return (
    // role="img" with label makes the whole card a single accessible object
    <div style={{ position: 'relative', flexShrink: 0 }} role="img" aria-label="Example verified student profile for Aisha Syed, UMass CS 2026, showing two attested work records and a 94% job match">
      {/* Floating chips — decorative, not read by screen readers */}
      <div aria-hidden="true" style={{ position: 'absolute', top: -18, right: -10, zIndex: 10, background: C.surface, border: `1px solid ${C.border}`, padding: '6px 12px', fontSize: 12, color: C.accent, fontFamily: F.mono, animation: 'float 3s ease-in-out infinite', whiteSpace: 'nowrap' }}>
        ✓ Attestation received
      </div>
      <div aria-hidden="true" style={{ position: 'absolute', bottom: 64, left: -20, zIndex: 10, background: C.surface, border: `1px solid ${C.border}`, padding: '6px 12px', fontSize: 12, color: C.textMuted, fontFamily: F.mono, animation: 'float 3.5s ease-in-out infinite 0.7s', whiteSpace: 'nowrap' }}>
        ↑ Skills verified by employer
      </div>

      {/* Card */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 28, width: 340, boxShadow: '0 32px 64px rgba(0,0,0,0.5)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: F.serif, fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 3 }}>Aisha Syed</div>
            <div style={{ fontSize: 12, color: C.textMuted, fontFamily: F.mono }}>UMass · CS 2026</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: C.accentHover, padding: '4px 8px', border: `1px solid ${C.accentBorder}` }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <circle cx="5" cy="5" r="4.5" stroke={C.accent} strokeWidth="1" />
              <path d="M3 5l1.5 1.5 2.5-3" stroke={C.accent} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: 10, color: C.accent, fontFamily: F.mono, fontWeight: 500 }}>VERIFIED</span>
          </div>
        </div>

        {/* Skills */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: C.textFaint, fontFamily: F.mono, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Verified skills</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['React', 'Python', 'Data Analysis'].map(skill => (
              <span key={skill} style={{ fontSize: 11, padding: '3px 8px', background: C.surfaceAlt, border: `1px solid ${C.textGhost}`, color: C.textSub, fontFamily: F.mono }}>{skill}</span>
            ))}
          </div>
        </div>

        {/* Work record */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: C.textFaint, fontFamily: F.mono, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Work record</div>

          <div style={{ ...anim(step >= 1), background: C.surfaceAlt, border: `1px solid ${C.border}`, padding: '10px 12px', marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, color: C.textSub, fontWeight: 500, marginBottom: 2 }}>Human Service Forum</div>
                <div style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>8 wks · React, SQL</div>
              </div>
              <div style={{ fontSize: 10, color: C.accent, fontFamily: F.mono, fontWeight: 500 }}>✓ ATTESTED</div>
            </div>
          </div>

          <div style={{ ...anim(step >= 2), background: C.surfaceAlt, border: `1px solid ${C.border}`, padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, color: C.textSub, fontWeight: 500, marginBottom: 2 }}>Pioneer Valley Co-op</div>
                <div style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>6 wks · Python, Data Analysis</div>
              </div>
              <div style={{ fontSize: 10, color: C.accent, fontFamily: F.mono, fontWeight: 500 }}>✓ ATTESTED</div>
            </div>
          </div>
        </div>

        {/* Match bar */}
        <div style={{ ...anim(step >= 3), background: C.surfaceAlt, border: `1px solid ${C.border}`, padding: '10px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.mono }}>Match: Seed-stage eng. role</div>
            <div style={{ fontSize: 12, color: C.accent, fontFamily: F.mono, fontWeight: 700 }}>94%</div>
          </div>
          <div style={{ height: 4, background: C.border, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: C.accent, width: step >= 3 ? '94%' : '0%', transition: 'width 1.2s ease-out 0.3s' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

export function Hero() {
  return (
    <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', padding: '120px 24px 80px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%', display: 'grid', gridTemplateColumns: '1fr auto', gap: 80, alignItems: 'center' }}>
        {/* Left */}
        <div>
          <div style={{ fontFamily: F.mono, fontSize: 11, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20 }}>
            Verified CS internship &amp; project board
          </div>
          <h1 style={{ fontFamily: F.serif, fontSize: 62, fontWeight: 800, lineHeight: 1.05, color: C.text, marginBottom: 24, letterSpacing: '-0.03em', margin: '0 0 24px' }}>
            Work that speaks<br />for itself.
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: C.textMuted, marginBottom: 36, maxWidth: 440 }}>
            Students do real CS work at SMBs, startups, and nonprofits. Employers verify at close. The record is permanent, portable, and proof — replacing the self-reported résumé with something that actually means something.
          </p>
          <div style={{ display: 'flex', gap: 12, marginBottom: 48 }}>
            <Link href="/login" style={{ padding: '12px 24px', background: C.accent, color: C.bg, fontWeight: 600, fontSize: 15, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              I&apos;m a student →
            </Link>
            <Link href="/login" style={{ padding: '12px 24px', border: `1px solid ${C.border}`, color: C.text, fontSize: 15, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', transition: 'border-color 0.2s' }}>
              Post a project
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, borderTop: `1px solid ${C.border}`, paddingTop: 28 }}>
            {[['200+', 'orgs in pipeline'], ['4K+', 'CS students'], ['$0', 'for students']].map(([num, label]) => (
              <div key={num}>
                <div style={{ fontFamily: F.mono, fontSize: 24, fontWeight: 700, color: C.text, marginBottom: 4 }}>{num}</div>
                <div style={{ fontSize: 12, color: C.textFaint, fontFamily: F.mono }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingRight: 32 }}>
          <AishaCard />
        </div>
      </div>
    </section>
  )
}
