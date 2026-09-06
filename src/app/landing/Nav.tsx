'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { C } from './tokens'
import { Wordmark } from './Wordmark'

const links: [string, string][] = [
  ['/', 'Mission'],
  ['/marketplace', 'Marketplace'],
  ['/how-it-works', 'How it works'],
  ['/about', 'About'],
]

/**
 * The marketing nav.
 *
 * A floating capsule rather than a full-width bar, which is the one place
 * the marketing site is allowed to be showier than the product. Inside the
 * app the nav is furniture — it should disappear and let you work. Out here
 * it is the first thing a stranger sees, and looking considered is part of
 * the argument.
 *
 * It detaches from the top edge on scroll: transparent and wide at rest,
 * then a glass pill with a gradient edge once the page moves under it. The
 * transition is the point — it tells you the page is responding to you
 * before you have read a word of it.
 */
export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24)
    fn()
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const lifted = scrolled || mobileOpen

  return (
    <div className="wm-nav-shell">
      <nav aria-label="Main navigation" className={`wm-nav${lifted ? ' wm-nav-lifted' : ''}`}>
        <Link href="/" aria-label="Workmark home" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }}>
          <Wordmark height={22} />
        </Link>

        <div className="mob-hide" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {links.map(([href, label]) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`wm-navlink${active ? ' wm-navlink-active' : ''}`}
              >
                {label}
              </Link>
            )
          })}
        </div>

        <div className="mob-hide" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <Link href="/login" className="wm-navlink">Sign in</Link>
          <Link href="/login" className="wm-nav-cta">Get started</Link>
        </div>

        <button
          className="mob-show wm-nav-burger"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M3 3l12 12M15 3L3 15" stroke={C.text} strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <line x1="2" y1="5.5" x2="16" y2="5.5" stroke={C.text} strokeWidth="1.6" strokeLinecap="round" />
              <line x1="2" y1="12.5" x2="16" y2="12.5" stroke={C.text} strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </nav>

      {mobileOpen && (
        <div className="wm-nav-sheet">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              aria-current={pathname === href ? 'page' : undefined}
              className={`wm-navlink${pathname === href ? ' wm-navlink-active' : ''}`}
              style={{ display: 'block', height: 'auto', padding: '12px 14px' }}
            >
              {label}
            </Link>
          ))}
          <Link href="/login" onClick={() => setMobileOpen(false)} className="wm-nav-cta" style={{ marginTop: 8, justifyContent: 'center' }}>
            Get started
          </Link>
        </div>
      )}
    </div>
  )
}
