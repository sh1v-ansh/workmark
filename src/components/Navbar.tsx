'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import { C, F } from '@/lib/theme/dark-tokens'
import { Wordmark } from '@/app/landing/Wordmark'

// Student-only in MVP. The role prop is kept (rather than removed) so
// company/faculty navs can be reintroduced at Tier 1+ without touching
// every call site again.
interface NavbarProps {
  role?: 'student'
  userName?: string
}

export default function Navbar({ role = 'student', userName }: NavbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()
  const [signing, setSigning] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleSignOut() {
    setSigning(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    toast('Signed out successfully', 'success')
    router.push('/login')
    router.refresh()
  }

  const dashboardHref = '/student/dashboard'

  const linkStyle = (href: string): React.CSSProperties => ({
    fontSize: 13, fontFamily: F.mono, textDecoration: 'none',
    color: pathname === href ? C.text : C.textMuted,
    borderBottom: `1px solid ${pathname === href ? C.accent : 'transparent'}`,
    paddingBottom: 2, transition: 'color 0.15s', letterSpacing: '-0.01em',
  })

  return (
    <header style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, zIndex: 40 }}>
      <nav aria-label="Main navigation" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Logo */}
        <Link href={dashboardHref} aria-label="Workmark dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <Wordmark height={27} />
        </Link>

        {/* Desktop links */}
        <div className="mob-hide" style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <Link href="/listings" aria-current={pathname === '/listings' ? 'page' : undefined} style={linkStyle('/listings')}>Projects</Link>
          {role === 'student' && (
            <>
              <Link href="/me" aria-current={pathname === '/me' ? 'page' : undefined} style={linkStyle('/me')}>My record</Link>
              <Link href="/students" aria-current={pathname === '/students' ? 'page' : undefined} style={linkStyle('/students')}>Students</Link>
            </>
          )}
          <Link href={dashboardHref} aria-current={pathname === dashboardHref ? 'page' : undefined} style={linkStyle(dashboardHref)}>Dashboard</Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingLeft: 16, borderLeft: `1px solid ${C.border}` }}>
            {userName && (
              <span style={{ fontSize: 12, color: C.textFaint, fontFamily: F.mono, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userName}
              </span>
            )}
            <button onClick={handleSignOut} disabled={signing}
              style={{ padding: '6px 14px', fontFamily: F.mono, fontSize: 12, border: `1px solid ${C.border}`, color: C.textMuted, background: 'transparent', cursor: signing ? 'not-allowed' : 'pointer', transition: 'all 0.15s', opacity: signing ? 0.5 : 1 }}>
              {signing ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>

        {/* Mobile hamburger */}
        <button className="mob-show" style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 8, alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}>
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
      </nav>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div style={{ borderTop: `1px solid ${C.border}`, background: C.bg, padding: '8px 24px 24px' }}>
          {userName && (
            <p style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, padding: '12px 0', borderBottom: `1px solid ${C.border}`, marginBottom: 4 }}>{userName}</p>
          )}
          {[
            { href: '/listings', label: 'Projects' },
            ...(role === 'student' ? [{ href: '/me', label: 'My record' }] : []),
            { href: dashboardHref, label: 'Dashboard' },
          ].map(({ href, label }) => (
            <Link key={href} href={href} onClick={() => setMobileOpen(false)} aria-current={pathname === href ? 'page' : undefined}
              style={{ display: 'block', fontFamily: F.mono, fontSize: 13, color: pathname === href ? C.accent : C.textMuted, textDecoration: 'none', padding: '13px 0', borderBottom: `1px solid ${C.border}` }}>
              {label}
            </Link>
          ))}
          <button onClick={handleSignOut} disabled={signing}
            style={{ marginTop: 16, width: '100%', padding: '11px 0', background: 'none', border: `1px solid ${C.border}`, color: C.textMuted, fontFamily: F.mono, fontSize: 12, cursor: signing ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {signing ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </header>
  )
}
