'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import { C, F } from '@/app/landing/tokens'
import { LogoMark } from '@/app/landing/LogoMark'

interface NavbarProps {
  role: 'student' | 'company' | 'faculty'
  userName?: string
}

export default function Navbar({ role, userName }: NavbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()
  const [signing, setSigning] = useState(false)

  async function handleSignOut() {
    setSigning(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    toast('Signed out successfully', 'success')
    router.push('/login')
    router.refresh()
  }

  const dashboardHref = role === 'student' ? '/student/dashboard' : role === 'faculty' ? '/faculty/dashboard' : '/company/dashboard'

  const linkStyle = (href: string): React.CSSProperties => ({
    fontSize: 13,
    fontFamily: F.mono,
    textDecoration: 'none',
    color: pathname === href ? C.text : C.textMuted,
    borderBottom: `1px solid ${pathname === href ? C.accent : 'transparent'}`,
    paddingBottom: 2,
    transition: 'color 0.15s',
    letterSpacing: '-0.01em',
  })

  return (
    <header style={{ background: 'rgba(13,13,11,0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, zIndex: 40 }}>
      <nav aria-label="Main navigation" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Logo */}
        <Link href={dashboardHref} aria-label="Workmark dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <LogoMark size={18} />
          <span style={{ fontFamily: F.mono, fontSize: 14, fontWeight: 500, color: C.text, letterSpacing: '-0.02em' }} aria-hidden="true">workmark</span>
        </Link>

        {/* Nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <Link href="/projects" aria-current={pathname === '/projects' ? 'page' : undefined} style={linkStyle('/projects')}>
            Browse
          </Link>
          <Link href={dashboardHref} aria-current={pathname === dashboardHref ? 'page' : undefined} style={linkStyle(dashboardHref)}>
            Dashboard
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingLeft: 16, borderLeft: `1px solid ${C.border}` }}>
            {userName && (
              <span style={{ fontSize: 12, color: C.textFaint, fontFamily: F.mono, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userName}
              </span>
            )}
            <button
              onClick={handleSignOut}
              disabled={signing}
              style={{
                padding: '6px 14px', fontFamily: F.mono, fontSize: 12,
                border: `1px solid ${C.border}`, color: C.textMuted,
                background: 'transparent', cursor: signing ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s', opacity: signing ? 0.5 : 1,
              }}
            >
              {signing ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      </nav>
    </header>
  )
}
