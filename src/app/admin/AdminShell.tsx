'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { Kicker } from '@/components/ui/Section'
import { C, R, T } from '@/lib/theme/dark-tokens'
import { LAYOUT } from '@/lib/theme/layout'

const SECTIONS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/queue', label: 'Queue' },
  { href: '/admin/people', label: 'People' },
  { href: '/admin/fairness', label: 'Fairness' },
  { href: '/admin/audit', label: 'Audit log' },
]

/**
 * Shared frame for every admin page.
 *
 * Same design language as the rest of the product — same paper, same type,
 * same components — rather than a separate-looking back office. Staff are
 * also using the product as themselves, and two visual worlds means two
 * things to maintain and a jarring switch between them.
 *
 * The one deliberate difference is the count badge on Queue: it's the only
 * section where sitting still has a consequence, so it says how much is
 * waiting from wherever you are.
 */
export default function AdminShell({ title, lede, queueCount = 0, overdueCount = 0, children }: {
  title: string
  lede?: string
  queueCount?: number
  overdueCount?: number
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <Navbar isAdmin />

      <main id="main-content" style={{ maxWidth: LAYOUT.maxWidth, margin: '0 auto', padding: '30px 28px 72px' }}>
        <Kicker style={{ marginBottom: 7 }}>Admin</Kicker>
        <h1 style={{ fontSize: T.h1, fontWeight: 800, letterSpacing: '-0.03em', color: C.text, marginBottom: lede ? 7 : 20 }}>
          {title}
        </h1>
        {lede && (
          <p style={{ fontSize: 14.5, color: C.textMuted, lineHeight: 1.6, maxWidth: '62ch', marginBottom: 20 }}>
            {lede}
          </p>
        )}

        <nav
          aria-label="Admin sections"
          style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 26, borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}
        >
          {SECTIONS.map((s) => {
            const active = s.href === '/admin' ? pathname === '/admin' : pathname.startsWith(s.href)
            return (
              <Link
                key={s.href}
                href={s.href}
                className={`nb-tab${active ? ' nb-tab-active' : ''}`}
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 7 }}
              >
                {s.label}
                {s.href === '/admin/queue' && queueCount > 0 && (
                  <span style={{
                    fontSize: 11.5, fontWeight: 700, lineHeight: 1,
                    padding: '3px 6.5px', borderRadius: R.pill,
                    background: overdueCount > 0 ? '#B91C1C' : C.accent,
                    color: '#fff',
                  }}>
                    {queueCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {children}
      </main>
    </div>
  )
}
