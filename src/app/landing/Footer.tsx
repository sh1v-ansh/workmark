import Link from 'next/link'
import { C, F } from './tokens'
import { Wordmark } from './Wordmark'

/**
 * The footer.
 *
 * It was a logo and one flat row of every link on the site, which is a
 * sitemap rather than a footer — "Terms" and "Marketplace" carried the same
 * weight, and a reader looking for a way to contact us found nothing at all.
 *
 * Four columns instead, grouped by what somebody is actually trying to do:
 * find out what this is, use it, get help, or check the legal position. The
 * contact addresses are the real addition. A product asking students to
 * connect their GitHub and then offering no way to reach a human is asking
 * for a trust it has not earned.
 */

const COLUMNS: { title: string; links: [string, string][] }[] = [
  {
    title: 'Product',
    links: [
      ['/', 'Mission'],
      ['/how-it-works', 'How it works'],
      ['/listings', 'Open projects'],
      ['/levels', 'How levels work'],
    ],
  },
  {
    title: 'Get started',
    links: [
      ['/login', 'Create a record'],
      ['/listings/new', 'Post a project'],
      ['/marketplace', 'For organisations'],
      ['/about', 'About us'],
    ],
  },
  {
    title: 'Legal',
    links: [
      ['/legal/privacy', 'Privacy policy'],
      ['/legal/terms', 'Terms of service'],
      ['/legal/cookies', 'Cookie policy'],
    ],
  },
]

/** Both real inboxes. Neither is a form that goes nowhere. */
const CONTACT: [string, string][] = [
  ['support@workmark.org', 'Support'],
  ['privacy@workmark.org', 'Privacy requests'],
]

export function Footer() {
  return (
    <footer className="wm-footer">
      <div className="wm-footer-inner">
        <div className="wm-footer-grid">
          <div>
            <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', marginBottom: 12 }}>
              <Wordmark height={22} />
            </Link>
            <p style={{ fontFamily: F.sans, fontSize: 14, color: C.textMuted, lineHeight: 1.6, maxWidth: '34ch', marginBottom: 18 }}>
              A record of what you have actually built, read from your own code — so the first
              thing an employer sees is the work rather than a claim about it.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {CONTACT.map(([address, label]) => (
                <a
                  key={address}
                  href={`mailto:${address}`}
                  style={{ fontFamily: F.sans, fontSize: 13.5, color: C.accent, textDecoration: 'none' }}
                >
                  {address}
                  <span style={{ color: C.textGhost, marginLeft: 7 }}>{label}</span>
                </a>
              ))}
            </div>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="wm-footer-col-title">{column.title}</p>
              {column.links.map(([href, label]) => (
                <Link key={href} href={href} className="wm-footer-link">{label}</Link>
              ))}
            </div>
          ))}
        </div>

        <div className="wm-footer-base">
          <span style={{ fontFamily: F.sans, fontSize: 12.5, color: C.textGhost }}>
            © {new Date().getFullYear()} Workmark · Built by students, for students, at UMass Amherst.
          </span>
          <span style={{ fontFamily: F.sans, fontSize: 12.5, color: C.textGhost }}>
            Made in Amherst, Massachusetts
          </span>
        </div>
      </div>
    </footer>
  )
}
