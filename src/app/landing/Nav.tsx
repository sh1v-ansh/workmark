'use client'

import { useEffect, useState } from 'react'
import { C, F } from './tokens'
import { LogoMark } from './LogoMark'

function go(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

const links: [string, string][] = [
  ['how-it-works', 'How it works'],
  ['verification', 'Verification'],
  ['for-you', 'For you'],
  ['waitlist', 'Join waitlist'],
]

export function Nav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <nav
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        transition: 'background 0.3s, border-color 0.3s',
        background: scrolled ? 'rgba(13,13,11,0.88)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: `1px solid ${scrolled ? C.border : 'transparent'}`,
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <LogoMark />
          <span style={{ fontFamily: F.mono, fontSize: 15, fontWeight: 500, color: C.text, letterSpacing: '-0.02em' }}>workmark</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          {links.map(([id, label]) => (
            <button
              key={id}
              onClick={() => go(id)}
              style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 14, fontFamily: F.sans, padding: 0, transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = C.text)}
              onMouseLeave={e => (e.currentTarget.style.color = C.textMuted)}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={() => go('waitlist')}
          style={{ padding: '8px 16px', fontFamily: F.mono, fontSize: 13, fontWeight: 500, border: `1px solid ${C.accent}`, color: C.accent, background: 'transparent', cursor: 'pointer', letterSpacing: '-0.01em', transition: 'background 0.2s' }}
          onMouseEnter={e => (e.currentTarget.style.background = C.accentHover)}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          Get early access
        </button>
      </div>
    </nav>
  )
}
