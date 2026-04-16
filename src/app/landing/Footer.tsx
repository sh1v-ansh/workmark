'use client'

import { C, F } from './tokens'
import { LogoMark } from './LogoMark'

const links: [string, string][] = [
  ['how-it-works', 'How it works'],
  ['verification', 'Verification'],
  ['for-you', 'For you'],
  ['waitlist', 'Waitlist'],
]

function go(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

export function Footer() {
  return (
    <footer style={{ borderTop: `1px solid ${C.border}`, padding: '40px 24px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <LogoMark />
            <span style={{ fontFamily: F.mono, fontSize: 14, fontWeight: 500, color: C.text }}>workmark</span>
          </div>
          <div style={{ fontSize: 12, color: C.textFaint, fontFamily: F.mono }}>Verified work, not just claimed work.</div>
        </div>
        <div style={{ display: 'flex', gap: 28 }}>
          {links.map(([id, label]) => (
            <button
              key={id}
              onClick={() => go(id)}
              style={{ background: 'none', border: 'none', color: C.textFaint, cursor: 'pointer', fontSize: 13, fontFamily: F.sans, padding: 0, transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = C.textMuted)}
              onMouseLeave={e => (e.currentTarget.style.color = C.textFaint)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ paddingTop: 20, borderTop: `1px solid ${C.borderFaint}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: C.textGhost, fontFamily: F.mono }}>© 2025 Workmark. All rights reserved.</div>
        <div style={{ fontSize: 12, color: C.textGhost, fontFamily: F.mono }}>Built for the students who build things.</div>
      </div>
    </footer>
  )
}
