'use client'

import Link from 'next/link'
import { Aurora } from './Aurora'
import { HOME } from './audience'
import { C, F } from './tokens'

/**
 * The hero.
 *
 * One headline for both readers now. The page used to switch between a
 * student pitch and an employer pitch; Workmark is one product with two
 * sides, so the top says both halves in one sentence and gives each reader
 * their own button.
 */
export function MissionHero() {
  const copy = HOME.hero

  return (
    <section style={{ position: 'relative', padding: '138px 24px 92px', overflow: 'hidden' }}>
      <Aurora height={900} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 880, margin: '0 auto', textAlign: 'center' }}>
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
          <Link href={copy.studentCta.href} className="wm-cta-primary">{copy.studentCta.label}</Link>
          <a href={copy.employerCta.href} className="wm-cta-ghost">{copy.employerCta.label}</a>
        </div>

        <p style={{ fontFamily: F.sans, fontSize: 13, color: C.textFaint }}>
          {copy.reassurance}
        </p>
      </div>
    </section>
  )
}
