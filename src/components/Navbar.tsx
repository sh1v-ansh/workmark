'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import { C, F, R } from '@/lib/theme/dark-tokens'
import { Wordmark } from '@/app/landing/Wordmark'

// Student-only in MVP. The role prop is kept (rather than removed) so
// company/faculty navs can be reintroduced at Tier 1+ without touching
// every call site again.
interface NavbarProps {
  role?: 'student'
  userName?: string
}

// Three tabs, down from five.
//
// The old nav asked the user to hold our model in their head: Projects,
// Next steps, My record, Students, Dashboard — three of which were "things
// about me" with no way to tell them apart. These three answer the only
// three questions a student actually arrives with: what needs me, where's
// the work, what do I have. Everything else is reachable from inside one of
// them or from the account menu, which is where secondary surfaces belong.
const TABS = [
  { href: '/student/dashboard', label: 'Home',      also: ['/goals'] },
  { href: '/listings',          label: 'Find work', also: [] as string[] },
  { href: '/me',                label: 'My record', also: ['/me/file', '/me/briefs', '/student/github'] },
]

const MENU = [
  { href: '/student/github', label: 'Evidence source & rescan' },
  { href: '/students', label: 'Student directory' },
  { href: '/me/briefs', label: 'Project ideas' },
  { href: '/me/file', label: 'Your file & disputes' },
]

function initials(name?: string) {
  if (!name) return '·'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '·'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export default function Navbar({ role = 'student', userName }: NavbarProps) {
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

  const isActive = (tab: (typeof TABS)[number]) =>
    pathname === tab.href || tab.also.some((p) => pathname === p)

  return (
    <header style={{ background: C.bg, position: 'sticky', top: 0, zIndex: 40 }}>
      <nav aria-label="Main navigation" style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 28px 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          {/* Logo + tabs */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 28, minWidth: 0 }}>
            <Link href="/student/dashboard" aria-label="Workmark home" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', paddingBottom: 9 }}>
              <Wordmark height={22} />
            </Link>
            {role === 'student' && (
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
          <div className="mob-hide" style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 9 }}>
            <Link href="/listings/new" style={{ fontSize: 14, color: C.textMuted, textDecoration: 'none', fontWeight: 500 }}>
              Post a project
            </Link>
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Account menu"
                style={{
                  width: 34, height: 34, borderRadius: R.md, border: 'none', cursor: 'pointer',
                  background: menuOpen ? C.accent : '#EDE9FF',
                  color: menuOpen ? '#fff' : C.accentInk,
                  fontFamily: F.display, fontSize: 12, fontWeight: 700, letterSpacing: '0.02em',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {initials(userName)}
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  style={{
                    position: 'absolute', right: 0, top: 42, minWidth: 218, zIndex: 50,
                    background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.lg,
                    boxShadow: '0 4px 6px rgba(25,30,46,0.04), 0 12px 32px rgba(25,30,46,0.10)',
                    padding: 6,
                  }}
                >
                  {userName && (
                    <p style={{ fontSize: 13, color: C.textFaint, padding: '8px 12px 10px', borderBottom: `1px solid ${C.borderFaint}`, marginBottom: 4 }}>
                      {userName}
                    </p>
                  )}
                  {MENU.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      style={{ display: 'block', fontSize: 15, color: C.textSub, textDecoration: 'none', padding: '9px 12px', borderRadius: 8 }}
                    >
                      {item.label}
                    </Link>
                  ))}
                  <div style={{ borderTop: `1px solid ${C.borderFaint}`, marginTop: 4, paddingTop: 4 }}>
                    <button
                      onClick={handleSignOut}
                      disabled={signing}
                      role="menuitem"
                      style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 15, color: C.textMuted, background: 'none', border: 'none', padding: '9px 12px', borderRadius: 8, cursor: signing ? 'not-allowed' : 'pointer', font: 'inherit' }}
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
          {userName && (
            <p style={{ fontSize: 13, color: C.textFaint, padding: '14px 0 10px', borderBottom: `1px solid ${C.borderFaint}`, marginBottom: 4 }}>{userName}</p>
          )}
          {[
            ...(role === 'student' ? TABS.map((t) => ({ href: t.href, label: t.label })) : []),
            { href: '/listings/new', label: 'Post a project' },
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
