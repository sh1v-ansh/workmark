'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { C, F } from './tokens'
import { LogoMark } from './LogoMark'

const links: [string, string][] = [
  ['/', 'Home'],
  ['/how-it-works', 'How it works'],
  ['/pricing', 'Pricing'],
  ['/about', 'About'],
]

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const navBg = scrolled || mobileOpen ? 'rgba(255,255,255,0.9)' : 'transparent'
  const navBlur = scrolled || mobileOpen ? 'blur(16px)' : 'none'
  const navBorder = scrolled || mobileOpen ? C.border : 'transparent'

  return (
    <nav
      aria-label="Main navigation"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        transition: 'background 0.3s, border-color 0.3s',
        background: navBg,
        backdropFilter: navBlur,
        WebkitBackdropFilter: navBlur,
        borderBottom: `1px solid ${navBorder}`,
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" aria-label="Workmark home" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <LogoMark />
          <span style={{ fontFamily: F.serif, fontSize: 19, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }} aria-hidden="true">workmark</span>
        </Link>

        {/* Desktop links */}
        <div className="mob-hide" style={{ display: 'flex', alignItems: 'center', gap: 32 }} role="list">
          {links.map(([href, label]) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                role="listitem"
                aria-current={active ? 'page' : undefined}
                style={{
                  fontSize: 14, fontFamily: F.sans, textDecoration: 'none',
                  color: active ? C.text : C.textMuted,
                  borderBottom: active ? `1px solid ${C.accent}` : '1px solid transparent',
                  paddingBottom: 2, transition: 'color 0.2s',
                }}
              >
                {label}
              </Link>
            )
          })}
        </div>

        {/* Desktop sign in */}
        <Link
          href="/login"
          className="mob-hide"
          style={{
            display: 'inline-block',
            padding: '8px 18px', fontFamily: F.mono, fontSize: 13, fontWeight: 500,
            border: `1px solid ${C.border}`, color: C.textMuted, textDecoration: 'none',
            transition: 'all 0.2s',
          }}
        >
          Sign in
        </Link>

        {/* Mobile hamburger */}
        <button
          className="mob-show"
          style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 8, alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M3 3l12 12M15 3L3 15" stroke={C.textMuted} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <line x1="2" y1="5" x2="16" y2="5" stroke={C.textMuted} strokeWidth="1.5" strokeLinecap="round" />
              <line x1="2" y1="9" x2="16" y2="9" stroke={C.textMuted} strokeWidth="1.5" strokeLinecap="round" />
              <line x1="2" y1="13" x2="16" y2="13" stroke={C.textMuted} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div style={{ borderTop: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.98)', padding: '8px 24px 24px' }}>
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              aria-current={pathname === href ? 'page' : undefined}
              style={{
                display: 'block', fontFamily: F.sans, fontSize: 14,
                color: pathname === href ? C.accent : C.textMuted,
                textDecoration: 'none', padding: '13px 0',
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              {label}
            </Link>
          ))}
          <Link
            href="/login"
            onClick={() => setMobileOpen(false)}
            style={{
              display: 'block', marginTop: 16, padding: '11px 0', textAlign: 'center',
              border: `1px solid ${C.border}`, color: C.textMuted,
              fontFamily: F.mono, fontSize: 12, textDecoration: 'none',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}
          >
            Sign in
          </Link>
        </div>
      )}
    </nav>
  )
}
