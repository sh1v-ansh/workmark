'use client'

import Link from 'next/link'
import { Aurora } from './Aurora'
import { COPY, type Audience } from './audience'
import { F } from './tokens'

/**
 * The last thing on the page.
 *
 * Named WaitlistSection for historical reasons — there is no waitlist and
 * has not been one since signup started refusing under-18s outright rather
 * than holding them. The export is JoinSection; the filename is left alone
 * because renaming it is churn in a diff about the landing page.
 *
 * One action. The old version offered three, which on a closing screen is a
 * way of admitting you do not know what you want the reader to do.
 */
const CLOSING: Record<Audience, { headline: string; body: string; note: string }> = {
  students: {
    headline: 'Connect GitHub and start your first project',
    body: 'Get a verified profile, a guided project at your level, and opportunities sent to you.',
    note: 'Free with a .edu email. You pick the repositories and can disconnect any time.',
  },
  businesses: {
    headline: 'Start with a paid project and see real output',
    body: 'Describe the work in a few lines. Every candidate has a verified work history and has opted in as open to work.',
    note: 'Free to post. No contract.',
  },
}

export function JoinSection({ audience }: { audience: Audience }) {
  const copy = CLOSING[audience]
  const cta = COPY[audience].primaryCta
  return (
    <section style={{ position: 'relative', overflow: 'hidden', padding: 'var(--wm-section-y) 24px', textAlign: 'center' }}>
      <Aurora height={620} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 620, margin: '0 auto' }}>
        <h2
          style={{
            fontFamily: F.serif, fontSize: 42, fontWeight: 600, letterSpacing: '-0.026em',
            lineHeight: 1.12, color: '#0A0A0A', margin: '0 0 16px', textWrap: 'balance',
          }}
        >
          {copy.headline}
        </h2>
        <p style={{ fontFamily: F.sans, fontSize: 17.5, lineHeight: 1.62, color: '#4B4B57', margin: '0 auto 30px', textWrap: 'pretty' }}>
          {copy.body}
        </p>
        <Link href={cta.href} className="wm-cta-primary">{cta.label}</Link>
        <p style={{ fontFamily: F.sans, fontSize: 13, color: '#6C6C78', marginTop: 18 }}>
          {copy.note}
        </p>
      </div>
    </section>
  )
}
