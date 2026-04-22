import Link from 'next/link'
import { C, F } from './tokens'
import { LogoMark } from './LogoMark'

const links: [string, string][] = [
  ['/', 'Home'],
  ['/how-it-works', 'How it works'],
  ['/about', 'About'],
  ['/login', 'Sign in'],
]

export function Footer() {
  return (
    <footer style={{ borderTop: `1px solid ${C.border}`, padding: '40px 24px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 6 }}>
            <LogoMark />
            <span style={{ fontFamily: F.mono, fontSize: 14, fontWeight: 500, color: C.text }}>workmark</span>
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
      <div style={{ paddingTop: 20, borderTop: `1px solid ${C.borderFaint}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: C.textGhost, fontFamily: F.mono }}>© 2026 Workmark. All rights reserved.</div>
        <div style={{ fontSize: 12, color: C.textGhost, fontFamily: F.mono }}>Built by a student, for students.</div>
      </div>
    </footer>
  )
}
