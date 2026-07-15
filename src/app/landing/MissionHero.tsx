'use client'

import { useState } from 'react'
import Link from 'next/link'
import { C, F } from './tokens'
import { Wordmark } from './Wordmark'
import { NetworkGraphic } from './NetworkGraphic'
import { VerificationSeal } from './VerificationSeal'

const RECORDS = [
  {
    name: 'Startup · Data pipeline',
    meta: '6 wks · Python, SQL',
    poster: 'Nova Analytics (sample)',
    posterType: 'Seed-stage startup',
    start: 'Mar 3, 2026',
    end: 'Apr 14, 2026',
    confirmedAt: 'Apr 15, 2026 · 9:02 AM',
    hash: 'wm_rec_7f3a9b2c1e4d',
  },
  {
    name: 'Nonprofit · Dashboard',
    meta: '8 wks · React, TS',
    poster: 'RiverLight Housing Coalition (sample)',
    posterType: 'Nonprofit',
    start: 'Jan 12, 2026',
    end: 'Mar 9, 2026',
    confirmedAt: 'Mar 10, 2026 · 4:41 PM',
    hash: 'wm_rec_2c9e51a0d8f3',
  },
  {
    name: 'Student team · CLI tool',
    meta: '4 wks · Go, Docker',
    poster: 'Devon R. (sample) · CS student',
    posterType: 'Peer poster',
    start: 'May 2, 2026',
    end: 'May 30, 2026',
    confirmedAt: 'May 31, 2026 · 11:15 AM',
    hash: 'wm_rec_9b1f4d76ae02',
  },
]

const TRUST_ITEMS: [string, string][] = [
  ['infinity', 'Free for students, forever'],
  ['box', 'Your records, exportable anytime'],
  ['no-doc', 'No résumé required'],
  ['code', 'Built by a CS student'],
]

function TrustIcon({ kind }: { kind: string }) {
  const common = { width: 13, height: 13, viewBox: '0 0 14 14', fill: 'none' as const }
  if (kind === 'infinity') {
    return (
      <svg {...common}>
        <path d="M4 7c0-1.4 1-2.2 2-1.2s1.4 2.4 2.6 2.4S10.4 7 10 5.8 8.6 4.8 7 6s-1.6 2.4-3 2.4S2.6 7 3 5.8" stroke={C.accent} strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    )
  }
  if (kind === 'box') {
    return (
      <svg {...common}>
        <path d="M2 5l5-2.5L12 5v4.5L7 12 2 9.5V5z" stroke={C.accent} strokeWidth="1.1" strokeLinejoin="round" />
        <path d="M2 5l5 2.5 5-2.5M7 7.5V12" stroke={C.accent} strokeWidth="1.1" strokeLinejoin="round" />
      </svg>
    )
  }
  if (kind === 'no-doc') {
    return (
      <svg {...common}>
        <path d="M4 2h4l2.5 2.5V12H4V2z" stroke={C.accent} strokeWidth="1.1" strokeLinejoin="round" />
        <path d="M5.5 6.5l3 3M8.5 6.5l-3 3" stroke={C.accent} strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M5 4L2 7l3 3M9 4l3 3-3 3" stroke={C.accent} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function MissionHero() {
  return (
    <section style={{ position: 'relative', padding: '140px 24px 80px', overflow: 'hidden' }}>
      {/* Soft violet wash */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', top: -120, left: '50%', transform: 'translateX(-50%)',
          width: 900, height: 600,
          background: 'radial-gradient(ellipse at center, rgba(62,31,255,0.08) 0%, transparent 62%)',
          pointerEvents: 'none', zIndex: 0,
        }}
      />
      {/* Constellation of verified nodes — signature texture moment */}
      <div aria-hidden="true" style={{ position: 'absolute', top: 40, left: 0, right: 0, height: 340, pointerEvents: 'none', zIndex: 0 }}>
        <NetworkGraphic />
      </div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 960, margin: '0 auto', textAlign: 'center' }}>
        <div className="wm-eyebrow" style={{ marginBottom: 28 }}>
          The verified work record layer for hiring
        </div>

        <h1 className="mob-text-hero" style={{ fontFamily: F.serif, fontSize: 72, fontWeight: 800, lineHeight: 1.03, letterSpacing: '-0.035em', color: C.text, margin: '0 0 28px' }}>
          Building the largest database of{' '}
          <span style={{ color: C.accent }}>verified work records</span>{' '}
          — to fix hiring.
        </h1>

        <p style={{ fontSize: 20, lineHeight: 1.6, color: C.textMuted, maxWidth: 680, margin: '0 auto 36px' }}>
          Résumés are self-reported and unverifiable. Workmark replaces the claim with proof:
          every project a student completes becomes a permanent, poster-attested record.
          Stack enough of them and your work speaks for itself.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 32 }}>
          <Link href="/login" className="wm-btn wm-btn-primary">
            Start your record →
          </Link>
          <Link href="/marketplace" className="wm-btn wm-btn-secondary">
            Explore the marketplace
          </Link>
        </div>

        {/* Honest trust bar — real policy commitments, no fabricated numbers */}
        <div style={{ display: 'flex', gap: 22, justifyContent: 'center', flexWrap: 'wrap' }}>
          {TRUST_ITEMS.map(([icon, label]) => (
            <div key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <TrustIcon kind={icon} />
              <span style={{ fontFamily: F.sans, fontSize: 12.5, color: C.textFaint }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Record strip — click a record to inspect its verification */}
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
  const [active, setActive] = useState<number | null>(null)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }} className="mob-1col">
        {RECORDS.map((r, i) => {
          const isActive = active === i
          return (
            <button
              key={r.name}
              onClick={() => setActive(isActive ? null : i)}
              aria-expanded={isActive}
              className="wm-card"
              style={{
                display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                font: 'inherit', appearance: 'none', WebkitAppearance: 'none',
                background: '#fff', border: `1px solid ${isActive ? C.accent : C.border}`,
                borderRadius: 12, padding: 18,
                boxShadow: isActive ? '0 10px 30px rgba(62,31,255,0.14)' : '0 10px 30px rgba(10,10,10,0.05)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontFamily: F.sans, fontSize: 10, fontWeight: 600, color: C.accent, letterSpacing: '0.08em' }}>✓ ATTESTED</span>
                <span style={{ fontFamily: F.sans, fontSize: 10, color: C.textGhost, letterSpacing: '0.06em' }}>WORKMARK</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>{r.name}</div>
              <div style={{ fontSize: 12, color: C.textFaint, fontFamily: F.sans, marginBottom: 10 }}>{r.meta}</div>
              <div style={{ fontFamily: F.sans, fontSize: 11, fontWeight: 600, color: isActive ? C.accent : C.textGhost }}>
                {isActive ? 'Hide verification ↑' : 'Tap to inspect verification →'}
              </div>
            </button>
          )
        })}
      </div>

      {active !== null && (
        <div
          className="reveal-item visible"
          style={{ marginTop: 12, background: C.surfaceAlt, border: `1px solid ${C.accentBorder}`, borderRadius: 14, padding: 26, textAlign: 'left' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
            <VerificationSeal />
            <button
              onClick={() => setActive(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: F.sans, fontSize: 12, color: C.textFaint, padding: 0 }}
            >
              Close ✕
            </button>
          </div>

          <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18, marginBottom: 18 }}>
            <DetailField label="Poster" value={RECORDS[active].poster} sub={RECORDS[active].posterType} />
            <DetailField label="Engagement" value={`${RECORDS[active].start} — ${RECORDS[active].end}`} sub={RECORDS[active].meta} />
            <DetailField label="Confirmed" value={RECORDS[active].confirmedAt} sub="Locked — no edits possible after" />
          </div>

          <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontFamily: F.mono, fontSize: 10.5, color: C.textFaint, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Record hash</span>
            <span style={{ fontFamily: F.mono, fontSize: 12, color: C.accent }}>{RECORDS[active].hash}…</span>
          </div>
        </div>
      )}
    </div>
  )
}

function DetailField({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <div style={{ fontFamily: F.sans, fontSize: 10, color: C.textGhost, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text, marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: C.textFaint }}>{sub}</div>
    </div>
  )
}
