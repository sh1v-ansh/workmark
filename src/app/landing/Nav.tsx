'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { C, F } from './tokens'
import { LogoMark } from './LogoMark'

const links: [string, string][] = [
  ['/', 'Home'],
  ['/how-it-works', 'How it works'],
  ['/about', 'About'],
]

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()

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
        background: scrolled ? 'rgba(13,13,11,0.72)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(16px)' : 'none',
        borderBottom: `1px solid ${scrolled ? C.border : 'transparent'}`,
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <LogoMark />
          <span style={{ fontFamily: F.mono, fontSize: 15, fontWeight: 500, color: C.text, letterSpacing: '-0.02em' }}>workmark</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          {links.map(([href, label]) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                style={{ fontSize: 14, fontFamily: F.sans, textDecoration: 'none', color: active ? C.text : C.textMuted, borderBottom: active ? `1px solid ${C.accent}` : '1px solid transparent', paddingBottom: 2, transition: 'color 0.2s' }}
              >
                {label}
              </Link>
            )
          })}
        </div>

        <Link
          href="/login"
          style={{ padding: '8px 18px', fontFamily: F.mono, fontSize: 13, fontWeight: 500, border: `1px solid ${C.border}`, color: C.textMuted, textDecoration: 'none', transition: 'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.color = C.text; e.currentTarget.style.borderColor = C.textMuted }}
          onMouseLeave={e => { e.currentTarget.style.color = C.textMuted; e.currentTarget.style.borderColor = C.border }}
        >
          Sign in
        </Link>
      </div>
    </nav>
  )
}
