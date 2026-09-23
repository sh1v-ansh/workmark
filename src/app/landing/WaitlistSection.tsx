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
    headline: 'You already did the hard part',
    body: 'The work is sitting in repos nobody is going to read. Connect them and see what they say about you.',
    note: 'Free with a .edu address. You pick the repos and can disconnect any time.',
  },
  businesses: {
    headline: 'Post it and see who turns up',
    body: 'Describe the work in a few lines. Everyone who applies comes with proof of what they have built.',
    note: 'Free to post. No contract, nothing to install, nothing to pay.',
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
