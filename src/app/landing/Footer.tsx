import Link from 'next/link'
import { C, F } from './tokens'
import { Wordmark } from './Wordmark'

const links: [string, string][] = [
  ['/', 'Mission'],
  ['/marketplace', 'Marketplace'],
  ['/how-it-works', 'How it works'],
  ['/about', 'About'],
  ['/login', 'Sign in'],
]

const legalLinks: [string, string][] = [
  ['/legal/privacy', 'Privacy'],
  ['/legal/terms', 'Terms'],
  ['/legal/acceptable-use', 'Acceptable use'],
]

export function Footer() {
  return (
    <footer style={{ borderTop: `1px solid ${C.border}`, padding: '40px 24px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 6 }}>
            <Wordmark />
          </Link>
          <div style={{ fontSize: 12, color: C.textFaint, fontFamily: F.mono }}>Verified work, not just claimed work.</div>
        </div>
        <div style={{ display: 'flex', gap: 28 }}>
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              style={{ fontSize: 13, fontFamily: F.sans, color: C.textFaint, textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = C.textMuted)}
              onMouseLeave={e => (e.currentTarget.style.color = C.textFaint)}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
      <div style={{ paddingTop: 20, borderTop: `1px solid ${C.borderFaint}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, color: C.textGhost, fontFamily: F.mono }}>
          © 2026 Workmark · Built by a student, for students.
        </div>
        {/* Reachable from every page, which is the point of them. A policy
            nobody can find is not a policy anyone agreed to. */}
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          {legalLinks.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              style={{ fontSize: 12, fontFamily: F.mono, color: C.textGhost, textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = C.textFaint)}
              onMouseLeave={e => (e.currentTarget.style.color = C.textGhost)}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  )
}
