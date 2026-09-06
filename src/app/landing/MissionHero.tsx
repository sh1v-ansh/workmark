'use client'

import Link from 'next/link'
import { Aurora } from './Aurora'
import { AudienceToggle } from './AudienceToggle'
import { COPY, type Audience } from './audience'
import { C, F } from './tokens'

/**
 * The hero.
 *
 * Every word of it comes from audience.ts, because the page says two
 * different things to two different readers and the alternative — a headline
 * that works for a student and a hiring manager at once — is a headline that
 * lands with neither.
 *
 * The switch sits above the headline rather than below it, so a business
 * that arrived on the student page sees the way out before it reads a pitch
 * aimed at somebody else.
 */
export function MissionHero({
  audience,
  onAudienceChange,
}: {
  audience: Audience
  onAudienceChange: (next: Audience) => void
}) {
  const copy = COPY[audience]

  return (
    <section style={{ position: 'relative', padding: '138px 24px 92px', overflow: 'hidden' }}>
      <Aurora height={900} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 880, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 26 }}>
          <AudienceToggle value={audience} onChange={onAudienceChange} />
        </div>

        <span
          style={{
            display: 'inline-block', marginBottom: 22, padding: '6px 14px', borderRadius: 999,
            background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(62,31,255,0.16)',
            backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            fontFamily: F.sans, fontSize: 13, color: C.textMuted,
          }}
        >
          {copy.eyebrow}
        </span>

        <h1
          className="mob-text-hero"
          style={{
            fontFamily: F.serif, fontSize: 62, fontWeight: 600, lineHeight: 1.06,
            letterSpacing: '-0.028em', color: C.text, margin: '0 0 24px', textWrap: 'balance',
          }}
        >
          {copy.headline}{' '}
          <span style={{
            background: 'linear-gradient(103deg, #3E1FFF 0%, #7F5CFF 42%, #EC4899 100%)',
            WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
          }}>
            {copy.headlineAccent}
          </span>
        </h1>

        <p style={{ fontFamily: F.sans, fontSize: 18.5, lineHeight: 1.62, color: C.textMuted, maxWidth: 660, margin: '0 auto 32px', textWrap: 'pretty' }}>
          {copy.lede}
        </p>

        <div style={{ display: 'flex', gap: 11, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <Link href={copy.primaryCta.href} className="wm-cta-primary">{copy.primaryCta.label}</Link>
          <Link href={copy.secondaryCta.href} className="wm-cta-ghost">{copy.secondaryCta.label}</Link>
        </div>

        <p style={{ fontFamily: F.sans, fontSize: 13, color: C.textFaint, marginBottom: 50 }}>
          {copy.reassurance}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 18, textAlign: 'left' }} className="mob-1col">
          {copy.proof.map(([title, detail]) => (
            <div
              key={title}
              style={{
                padding: '15px 17px', borderRadius: 14,
                background: 'rgba(255,255,255,0.62)',
                border: '1px solid rgba(255,255,255,0.9)',
                backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                boxShadow: '0 1px 2px rgba(25,30,46,0.03), 0 14px 34px -22px rgba(25,30,46,0.30)',
              }}
            >
              <p style={{ fontFamily: F.sans, fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 3 }}>{title}</p>
              <p style={{ fontFamily: F.sans, fontSize: 13, color: C.textFaint, lineHeight: 1.5 }}>{detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
