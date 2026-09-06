'use client'

import Link from 'next/link'
import { Aurora } from './Aurora'
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
export function JoinSection() {
  return (
    <section style={{ position: 'relative', overflow: 'hidden', padding: '104px 24px 116px', textAlign: 'center' }}>
      <Aurora height={620} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 620, margin: '0 auto' }}>
        <h2
          style={{
            fontFamily: F.serif, fontSize: 42, fontWeight: 600, letterSpacing: '-0.026em',
            lineHeight: 1.12, color: '#0A0A0A', margin: '0 0 16px', textWrap: 'balance',
          }}
        >
          You have already done the work
        </h2>
        <p style={{ fontFamily: F.sans, fontSize: 17.5, lineHeight: 1.62, color: '#4B4B57', margin: '0 auto 30px', textWrap: 'pretty' }}>
          It is sitting in repositories nobody is going to read. Connect them and find out what
          they say about you.
        </p>
        <Link href="/login" className="wm-cta-primary">Build my record</Link>
        <p style={{ fontFamily: F.sans, fontSize: 13, color: '#6C6C78', marginTop: 18 }}>
          Free with a .edu address. You choose which repositories, and you can disconnect at any time.
        </p>
      </div>
    </section>
  )
}
