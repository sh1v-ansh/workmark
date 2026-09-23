'use client'

import Link from 'next/link'
import { Aurora } from './Aurora'
import { COPY, HOME, type Audience } from './audience'
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
    headline: 'Connect GitHub and get your verified profile',
    body: 'Pick the repositories you want us to read. Your profile shows a level for each skill, with the work behind it.',
    note: 'Free with a .edu email. You pick the repositories and can disconnect any time.',
  },
  businesses: {
    headline: 'Tell us what you are hiring for',
    body: 'Describe the role in a few lines and we will show you candidates with verified work who are open to work.',
    note: 'Every candidate has opted in as open to work.',
  },
}

/**
 * The closing call to action.
 *
 * With an audience (the /how-it-works page, which has a toggle) it speaks to
 * that reader. Without one (the home page, which speaks to both) it gives
 * each side its own button.
 */
export function JoinSection({ audience }: { audience?: Audience }) {
  const copy = audience ? CLOSING[audience] : { ...HOME.closing, note: HOME.hero.reassurance }
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
        <div style={{ display: 'flex', gap: 11, justifyContent: 'center', flexWrap: 'wrap' }}>
          {audience ? (
            <a href={COPY[audience].primaryCta.href} className="wm-cta-primary">{COPY[audience].primaryCta.label}</a>
          ) : (
            <>
              <Link href={HOME.hero.studentCta.href} className="wm-cta-primary">{HOME.hero.studentCta.label}</Link>
              <a href={HOME.hero.employerCta.href} className="wm-cta-ghost">{HOME.hero.employerCta.label}</a>
            </>
          )}
        </div>
        <p style={{ fontFamily: F.sans, fontSize: 13, color: '#6C6C78', marginTop: 18 }}>
          {copy.note}
        </p>
      </div>
    </section>
  )
}
