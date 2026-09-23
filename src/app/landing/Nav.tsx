'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { C } from './tokens'
import { Wordmark } from './Wordmark'
import { COPY } from './audience'
import { AUDIENCE_ROUTES, ROUTE_AUDIENCES, useAudienceNav } from './audience-context'

/**
 * The two audience labels come from the toggle's own copy rather than being
 * typed again here. They named the same two things in two places before, and
 * the nav's names ("Mission", "Marketplace") had already drifted away from
 * what the pages actually were: one pitch to students, one to businesses.
 * "Marketplace" was the worst of them — it promised a board of open projects
 * and delivered a pitch page. The board is /listings.
 */
const LINKS: [string, string][] = [
  [AUDIENCE_ROUTES.students, COPY.students.tab],
  [AUDIENCE_ROUTES.businesses, COPY.businesses.tab],
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
  const nav = useAudienceNav()

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24)
    fn()
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const lifted = scrolled || mobileOpen

  /**
   * On the landing page the highlight follows the audience, not the URL.
   *
   * The toggle in the hero rewrites every section, so a nav that kept
   * "For students" lit while the page argued to businesses was simply
   * reporting something untrue. Everywhere else — /about, /how-it-works —
   * there is no audience and the pathname is the whole answer.
   */
  const activeHref = nav ? AUDIENCE_ROUTES[nav.audience] : pathname

  /**
   * Clicking the other side is a switch, not a journey.
   *
   * `/` and `/marketplace` render the identical component, so letting the
   * link navigate would tear down and rebuild the page to show the same
   * sections with one prop changed. Switching in place keeps it instant and
   * keeps the URL honest via AudienceLanding.
   *
   * Modified clicks are left alone so cmd-click still opens a real tab, and
   * these stay genuine <a href> elements so the routes remain crawlable.
   */
  function switchAudience(event: React.MouseEvent, href: string): void {
    const target = ROUTE_AUDIENCES[href]
    if (!nav || !target) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    event.preventDefault()
    nav.setAudience(target)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="wm-nav-shell">
      <nav aria-label="Main navigation" className={`wm-nav${lifted ? ' wm-nav-lifted' : ''}`}>
        <Link href="/" aria-label="Workmark home" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }}>
          <Wordmark height={22} />
        </Link>

        <div className="mob-hide" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {LINKS.map(([href, label]) => {
            const active = href === activeHref
            return (
              <Link
                key={href}
                href={href}
                onClick={(e) => switchAudience(e, href)}
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
          {LINKS.map(([href, label]) => {
            const active = href === activeHref
            return (
              <Link
                key={href}
                href={href}
                onClick={(e) => {
                  switchAudience(e, href)
                  setMobileOpen(false)
                }}
                aria-current={active ? 'page' : undefined}
                className={`wm-navlink${active ? ' wm-navlink-active' : ''}`}
                style={{ display: 'block', height: 'auto', padding: '12px 14px' }}
              >
                {label}
              </Link>
            )
          })}
          {/* Sign in was desktop-only, so a returning student on a phone had
              no way into their own account from the marketing site — the only
              button was "Get started", which is the wrong door for someone who
              already has one. */}
          <Link
            href="/login"
            onClick={() => setMobileOpen(false)}
            className="wm-navlink"
            style={{ display: 'block', height: 'auto', padding: '12px 14px' }}
          >
            Sign in
          </Link>
          {/* display:flex rather than the class's inline-flex, so the button
              fills the sheet like the rows above it instead of sitting at
              half width against them. */}
          <Link href="/login" onClick={() => setMobileOpen(false)} className="wm-nav-cta" style={{ marginTop: 8, display: 'flex', justifyContent: 'center' }}>
            Get started
          </Link>
        </div>
      )}
    </div>
  )
}
