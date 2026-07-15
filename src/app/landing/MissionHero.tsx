'use client'

import Link from 'next/link'
import { C, F } from './tokens'
import { Wordmark } from './Wordmark'

export function MissionHero() {
  return (
    <section style={{ position: 'relative', padding: '140px 24px 80px', overflow: 'hidden' }}>
      {/* Soft violet wash behind the headline */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', top: -120, left: '50%', transform: 'translateX(-50%)',
          width: 900, height: 600,
          background: 'radial-gradient(ellipse at center, rgba(62,31,255,0.08) 0%, transparent 62%)',
          pointerEvents: 'none', zIndex: 0,
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 960, margin: '0 auto', textAlign: 'center' }}>
        <div className="wm-eyebrow" style={{ marginBottom: 28 }}>
          The verified work record layer for hiring
        </div>

        <h1 className="mob-text-hero" style={{ fontFamily: F.serif, fontSize: 72, fontWeight: 800, lineHeight: 1.03, letterSpacing: '-0.035em', color: C.text, margin: '0 0 28px' }}>
          Building the largest database of{' '}
          <span style={{ color: C.accent }}>verified work records</span>{' '}
          — to fix hiring.
        </h1>

        <p style={{ fontSize: 20, lineHeight: 1.6, color: C.textMuted, maxWidth: 680, margin: '0 auto 40px' }}>
          Résumés are self-reported and unverifiable. Workmark replaces the claim with proof:
          every project a student completes becomes a permanent, employer-attested record.
          Stack enough of them and your work speaks for itself.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
          <Link href="/login" className="wm-btn wm-btn-primary">
            Start your record →
          </Link>
          <Link href="/marketplace" className="wm-btn wm-btn-secondary">
            Explore the marketplace
          </Link>
        </div>

        <p style={{ fontFamily: F.sans, fontSize: 13, color: C.textFaint }}>
          Free for students, forever · No résumé required
        </p>
      </div>

      {/* Record card strip — the "database" made concrete */}
      <div className="reveal-item" style={{ position: 'relative', zIndex: 1, maxWidth: 1000, margin: '72px auto 0' }}>
        <RecordStrip />
      </div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1000, margin: '28px auto 0', display: 'flex', justifyContent: 'center', opacity: 0.5 }}>
        <Wordmark height={18} />
      </div>
    </section>
  )
}

function RecordStrip() {
  const records = [
    { name: 'Startup · Data pipeline', meta: '6 wks · Python, SQL', tag: 'ATTESTED' },
    { name: 'Nonprofit · Dashboard', meta: '8 wks · React, TS', tag: 'ATTESTED' },
    { name: 'Student team · CLI tool', meta: '4 wks · Go, Docker', tag: 'ATTESTED' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }} className="mob-1col">
      {records.map((r) => (
        <div key={r.name} className="wm-card" style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, boxShadow: '0 10px 30px rgba(10,10,10,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontFamily: F.sans, fontSize: 10, fontWeight: 600, color: C.accent, letterSpacing: '0.08em' }}>✓ {r.tag}</span>
            <span style={{ fontFamily: F.sans, fontSize: 10, color: C.textGhost, letterSpacing: '0.06em' }}>WORKMARK</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>{r.name}</div>
          <div style={{ fontSize: 12, color: C.textFaint, fontFamily: F.sans }}>{r.meta}</div>
        </div>
      ))}
    </div>
  )
}
