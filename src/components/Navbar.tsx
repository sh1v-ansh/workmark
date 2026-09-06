'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import { useSession } from '@/components/SessionProvider'
import FeedbackLink from '@/components/FeedbackLink'
import { C, F, R } from '@/lib/theme/dark-tokens'
import { Wordmark } from '@/app/landing/Wordmark'
import { LAYOUT } from '@/lib/theme/layout'
import { isTabActive, type Tab } from '@/lib/nav/tabs'

// Everything the navbar needs now comes from the session context, read once
// in the root layout. Props are still accepted so the fourteen existing call
// sites keep working, but nothing has to pass them — which is the point,
// since the previous prop-based version was forgotten by twelve of them.
interface NavbarProps {
  role?: 'student' | 'faculty'
  userName?: string
  isAdmin?: boolean
}

// Three tabs, down from five (four for admins, who get the console here too).
//
// The old nav asked the user to hold our model in their head: Projects,
// Next steps, My record, Students, Dashboard — three of which were "things
// about me" with no way to tell them apart. These three answer the only
// three questions a student actually arrives with: what needs me, where's
// the work, what do I have. Everything else is reachable from inside one of
// them or from the account menu, which is where secondary surfaces belong.
const STUDENT_TABS: Tab[] = [
  { href: '/student/dashboard', label: 'Home',      also: ['/goals'] },
  { href: '/listings',          label: 'Find work', also: [] as string[] },
  { href: '/me',                label: 'My record', also: ['/me/file', '/me/briefs', '/student/github'] },
]

// Faculty arrive with different questions. "Find work" and "My record" mean
// nothing to a professor — they don't apply to projects and they have no
// scanned record. Theirs are: what needs me, who applied, who's building.
const FACULTY_TABS: Tab[] = [
  { href: '/faculty', label: 'Home', also: [] as string[] },
  { href: '/faculty/listings', label: 'My projects', also: ['/listings/new'] },
  { href: '/students', label: 'Students', also: [] as string[] },
]

// What's left in the account menu after the actions moved out.
//
// It had eight items, which is a list you read rather than a menu you use.
// Two of them were actions wearing a destination's clothes — "Evidence
// source & Rescan" and "Project ideas" — and both now sit on the record they
// change, where the student is already standing when they want them. Admin
// became a tab. What remains is what a menu is for: the low-traffic places
// that belong to you rather than to the page you are on.
const STUDENT_MENU = [
  { href: '/students', label: 'Student directory' },
  { href: '/me/file', label: 'Your file & disputes' },
  { href: '/account/settings', label: 'Settings' },
]

const FACULTY_MENU = [
  { href: '/students', label: 'Student directory' },
  { href: '/account/settings', label: 'Settings' },
]

// Admins get a real tab, not a menu entry.
//
// It was in the account menu on the reasoning that admin isn't a question
// anyone arrives with. That was wrong about who these people are: an admin
// opening Workmark is usually opening it to do admin, and hiding the console
// behind their own avatar is the one place nobody looks for a workspace
// switch. Nav bars are where people expect to change what they are doing.
const ADMIN_TAB: Tab = { href: '/admin', label: 'Admin', also: [], prefix: true }

function initials(name?: string) {
  if (!name) return '·'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '·'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export default function Navbar({ role, userName, isAdmin }: NavbarProps) {
  const session = useSession()
  // Props win when passed — a page that knows better than the session, such
  // as a public profile rendering for a signed-out visitor, keeps control.
  const effectiveRole = role ?? (session.isFaculty && !session.roles.includes('student') ? 'faculty' : 'student')
  const showAdmin = isAdmin ?? session.isAdmin
  const name = userName ?? session.displayName ?? undefined
  const baseTabs = effectiveRole === 'faculty' ? FACULTY_TABS : STUDENT_TABS
  // Last, not first — the console is where an admin goes, not where they
  // start, and the three product tabs stay in the same place for everyone.
  const TABS = showAdmin ? [...baseTabs, ADMIN_TAB] : baseTabs
  const MENU = effectiveRole === 'faculty' ? FACULTY_MENU : STUDENT_MENU
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()
  const [signing, setSigning] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // A menu that stays open after you click past it is a menu that feels
  // broken, so close on any outside pointer and on Escape.
  useEffect(() => {
    if (!menuOpen) return
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  async function handleSignOut() {
    setSigning(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    toast('Signed out successfully', 'success')
    router.push('/login')
    router.refresh()
  }

  const isActive = (tab: Tab) => isTabActive(tab, pathname)

  return (
    <header style={{ background: C.bg, position: 'sticky', top: 0, zIndex: 40 }}>
      {/* 1180 and 28px side padding, matching the page containers below.
          It was 1100, so content overhung the nav by 40px a side on every
          page that used the standard width — the nav and the page it framed
          were never on the same grid. */}
      <nav aria-label="Main navigation" style={{ maxWidth: LAYOUT.maxWidth, margin: '0 auto', padding: '18px 28px 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          {/* Logo + tabs */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 26, minWidth: 0 }}>
            <Link href="/student/dashboard" aria-label="Workmark home" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', paddingBottom: 8.5 }}>
              <Wordmark height={20} />
            </Link>
            {(
              <div className="mob-hide" style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                {TABS.map((tab) => (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    aria-current={isActive(tab) ? 'page' : undefined}
                    className={`nb-tab${isActive(tab) ? ' nb-tab-active' : ''}`}
                  >
                    {tab.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Right side */}
          <div className="mob-hide" style={{ display: 'flex', alignItems: 'center', gap: 13, paddingBottom: 8.5 }}>
            <Link href="/listings/new" style={{ fontSize: 13.5, color: C.textMuted, textDecoration: 'none', fontWeight: 500 }}>
              Post a project
            </Link>
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Account menu"
                style={{
                  width: 32, height: 32, borderRadius: R.md, border: 'none', cursor: 'pointer',
                  background: menuOpen ? C.accent : '#EDE9FF',
                  color: menuOpen ? '#fff' : C.accentInk,
                  fontFamily: F.display, fontSize: 11, fontWeight: 700, letterSpacing: '0.02em',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {initials(name)}
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  style={{
                    position: 'absolute', right: 0, top: 40, minWidth: 209, zIndex: 50,
                    background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.lg,
                    boxShadow: '0 4px 6px rgba(25,30,46,0.04), 0 12px 32px rgba(25,30,46,0.10)',
                    padding: 5.5,
                  }}
                >
                  {name && (
                    <p style={{ fontSize: 12.5, color: C.textFaint, padding: '7.5px 11.5px 9.5px', borderBottom: `1px solid ${C.borderFaint}`, marginBottom: 3.5 }}>
                      {name}
                    </p>
                  )}
                  {MENU.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      style={{ display: 'block', fontSize: 14, color: C.textSub, textDecoration: 'none', padding: '8.5px 11.5px', borderRadius: 7.5 }}
                    >
                      {item.label}
                    </Link>
                  ))}
                  {/* Two entries, not one. These are different acts: one
                      is a complaint and one is a favour, and putting them
                      behind a single link labelled "bug" meant the favour
                      was only reachable by first agreeing to file a
                      complaint. Both open a drawer rather than navigating,
                      because the page you are on is often the subject. */}
                  <div style={{ borderTop: `1px solid ${C.borderFaint}`, marginTop: 3.5, paddingTop: 6, paddingBottom: 2 }}>
                    <div style={{ padding: '5px 11.5px' }}>
                      <FeedbackLink kind="feature" style={{ fontSize: 14, color: C.textSub }} />
                    </div>
                    <div style={{ padding: '5px 11.5px' }}>
                      <FeedbackLink kind="bug" style={{ fontSize: 14, color: C.textSub }} />
                    </div>
                  </div>
                  {/* Deleting an account used to sit here, one row above
                      Sign out, same size, same grey — the most irreversible
                      thing in the product rendered as the least remarkable
                      and a mis-click from the thing people do daily. It is
                      at the bottom of Settings now, in red, on its own. */}
                  <div style={{ borderTop: `1px solid ${C.borderFaint}`, paddingTop: 3.5 }}>
                    <button
                      onClick={handleSignOut}
                      disabled={signing}
                      role="menuitem"
                      style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 14, color: C.textMuted, background: 'none', border: 'none', padding: '8.5px 11.5px', borderRadius: 7.5, cursor: signing ? 'not-allowed' : 'pointer', font: 'inherit' }}
                    >
                      {signing ? 'Signing out…' : 'Sign out'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile hamburger */}
          <button className="mob-show" style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 8, marginBottom: 4, alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}>
            {mobileOpen ? (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M3 3l12 12M15 3L3 15" stroke={C.textMuted} strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <line x1="2" y1="5" x2="16" y2="5" stroke={C.textMuted} strokeWidth="1.6" strokeLinecap="round" />
                <line x1="2" y1="9" x2="16" y2="9" stroke={C.textMuted} strokeWidth="1.6" strokeLinecap="round" />
                <line x1="2" y1="13" x2="16" y2="13" stroke={C.textMuted} strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
        <div style={{ borderBottom: `1px solid ${C.border}` }} />
      </nav>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '4px 28px 20px' }}>
          {name && (
            <p style={{ fontSize: 13, color: C.textFaint, padding: '14px 0 10px', borderBottom: `1px solid ${C.borderFaint}`, marginBottom: 4 }}>{name}</p>
          )}
          {[
            ...TABS.map((t) => ({ href: t.href, label: t.label })),
            ...(effectiveRole === 'student' ? [{ href: '/listings/new', label: 'Post a project' }] : []),
            ...MENU,
          ].map(({ href, label }) => (
            <Link key={href} href={href} onClick={() => setMobileOpen(false)} aria-current={pathname === href ? 'page' : undefined}
              style={{ display: 'block', fontSize: 16, fontWeight: pathname === href ? 600 : 400, color: pathname === href ? C.accent : C.textSub, textDecoration: 'none', padding: '13px 0', borderBottom: `1px solid ${C.borderFaint}` }}>
              {label}
            </Link>
          ))}
          <button onClick={handleSignOut} disabled={signing} className="nb-btn nb-btn-outline" style={{ marginTop: 16, width: '100%' }}>
            {signing ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </header>
  )
}
