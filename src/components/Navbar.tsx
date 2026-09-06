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
import { Icon, type IconName } from '@/components/Icon'

// Everything the navbar needs now comes from the session context, read once
// in the root layout. Props are still accepted so the fourteen existing call
// sites keep working, but nothing has to pass them — which is the point,
// since the previous prop-based version was forgotten by twelve of them.
interface MenuItem {
  href: string
  label: string
  icon: IconName
}

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
const STUDENT_MENU: MenuItem[] = [
  { href: '/students', label: 'Student directory', icon: 'users' },
  { href: '/me/file', label: 'Your file & disputes', icon: 'inbox' },
  { href: '/account/settings', label: 'Settings', icon: 'settings' },
]

const FACULTY_MENU: MenuItem[] = [
  { href: '/students', label: 'Student directory', icon: 'users' },
  { href: '/account/settings', label: 'Settings', icon: 'settings' },
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
    <header className="nb-header">
      {/* Three columns rather than two, so the tabs are centred on the page
          and not on whatever is left over after the logo. With flex the
          centre drifts every time the right-hand side changes width — an
          admin gains a tab, a name gets longer — and a navigation bar that
          moves when the account changes is the thing that read as unfinished.

          Same max width and side padding as the page containers below, so
          the nav and the page it frames sit on one grid. */}
      <nav
        aria-label="Main navigation"
        style={{
          maxWidth: LAYOUT.maxWidth, margin: '0 auto', padding: '0 28px',
          height: 62, display: 'grid', gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center', gap: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
          <Link href="/student/dashboard" aria-label="Workmark home" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <Wordmark height={21} />
          </Link>
        </div>

        {/* The tabs. Sentence case at 13.5px, not 11.5px uppercase — small
            caps in a nav bar is a typographic tic from the cream-paper
            version, and at that size it costs legibility for nothing. The
            old active state drew the tab as a page joining the sheet below
            it, a metaphor that needed the paper to work; on white it was
            three hairlines around some text. */}
        <div className="mob-hide" style={{ display: 'flex', alignItems: 'center', gap: 2, justifySelf: 'center' }}>
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive(tab) ? 'page' : undefined}
              className={`nb-navlink${isActive(tab) ? ' nb-navlink-active' : ''}`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <div className="mob-hide" style={{ display: 'flex', alignItems: 'center', gap: 10, justifySelf: 'end' }}>
          <Link href="/listings/new" className="nb-navlink">
            Post a project
          </Link>

          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Account menu"
              className="nb-avatar"
              data-open={menuOpen ? 'true' : undefined}
            >
              {initials(name)}
            </button>

            {menuOpen && (
              <div role="menu" className="nb-menu">
                {/* Who you are, before what you can do. The menu used to open
                    on a grey line of text that was only a name; it is the one
                    place in the product that answers "which account am I in",
                    which matters to anyone with a staff account and a real
                    one. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 14px 12px' }}>
                  <span className="nb-avatar nb-avatar-lg" aria-hidden="true">{initials(name)}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {name ?? 'Your account'}
                    </span>
                    <span style={{ display: 'block', fontSize: 12.5, color: C.textGhost, textTransform: 'capitalize' }}>
                      {showAdmin ? 'Staff' : effectiveRole}
                    </span>
                  </span>
                </div>

                <div className="nb-menu-rule" />

                <div className="nb-menu-group">
                  {MENU.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="nb-menu-item"
                    >
                      <Icon name={item.icon} size={15.5} style={{ color: C.textGhost }} />
                      {item.label}
                    </Link>
                  ))}
                </div>

                <div className="nb-menu-rule" />

                {/* Two entries, not one. These are different acts: one is a
                    complaint and one is a favour, and putting them behind a
                    single link labelled "bug" meant the favour was only
                    reachable by first agreeing to file a complaint. Both open
                    a drawer rather than navigating, because the page you are
                    on is often the subject. */}
                <div className="nb-menu-group">
                  <span className="nb-menu-item">
                    <Icon name="spark" size={15.5} style={{ color: C.accent }} />
                    <FeedbackLink kind="feature" style={{ fontSize: 14, color: 'inherit', fontWeight: 'inherit' }} />
                  </span>
                  <span className="nb-menu-item">
                    <Icon name="bug" size={15.5} style={{ color: C.textGhost }} />
                    <FeedbackLink kind="bug" style={{ fontSize: 14, color: 'inherit', fontWeight: 'inherit' }} />
                  </span>
                </div>

                <div className="nb-menu-rule" />

                <div className="nb-menu-group">
                  <button
                    onClick={handleSignOut}
                    disabled={signing}
                    role="menuitem"
                    className="nb-menu-item"
                    style={{ width: '100%', background: 'none', border: 'none', font: 'inherit', cursor: signing ? 'not-allowed' : 'pointer' }}
                  >
                    <Icon name="sign-out" size={15.5} style={{ color: C.textGhost }} />
                    {signing ? 'Signing out…' : 'Sign out'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile hamburger. Sits in the third grid column so it lands
            where the avatar does at wider widths, rather than jumping. */}
        <button className="mob-show" style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 8, justifySelf: 'end', alignItems: 'center', justifyContent: 'center' }}
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
            ...MENU.map((m) => ({ href: m.href, label: m.label })),
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
