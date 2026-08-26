'use client'

import Link from 'next/link'
import { C, R, T, state } from '@/lib/theme/dark-tokens'
import { Kicker } from '@/components/ui/Section'

/**
 * Shared pieces for the admin pages.
 *
 * A dashboard is scanned, not read, so state is encoded in shape and colour
 * as well as in words — a row that needs attention should be findable
 * without reading every row. Semantic colour only: green, amber and red mean
 * something here and are kept separate from the product's purple accent.
 */

export function StatGrid({ stats }: {
  stats: { label: string; value: number | string; note?: string }[]
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
      {stats.map((s) => (
        <div
          key={s.label}
          style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.md, padding: '15px 17px' }}
        >
          <p style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.textGhost, marginBottom: 6 }}>
            {s.label}
          </p>
          <p style={{ fontSize: 27, fontWeight: 700, letterSpacing: '-0.02em', color: C.text, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {s.value}
          </p>
          {s.note && <p style={{ fontSize: 12.5, color: state.caution, marginTop: 5 }}>{s.note}</p>}
        </div>
      ))}
    </div>
  )
}

export function Panel({ title, action, children }: {
  title: string
  action?: { href: string; label: string }
  children: React.ReactNode
}) {
  return (
    <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: '17px 19px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <Kicker>{title}</Kicker>
        {action && (
          <Link href={action.href} style={{ fontSize: 13, color: C.accentInk, textDecoration: 'none', fontWeight: 600 }}>
            {action.label} →
          </Link>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>{children}</div>
    </section>
  )
}

const STATE_COLOR = {
  ok:   { dot: state.positive, bg: state.positiveBg },
  info: { dot: C.textGhost,    bg: C.surfaceAlt },
  warn: { dot: state.caution,  bg: state.cautionBg },
  bad:  { dot: '#B91C1C',      bg: '#FBE6E6' },
} as const

export function HealthRow({ state: s, label, detail }: {
  state: keyof typeof STATE_COLOR
  label: string
  detail?: string
}) {
  const c = STATE_COLOR[s]
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <span
        aria-hidden="true"
        style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot, flexShrink: 0, marginTop: 6 }}
      />
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: C.text, lineHeight: 1.4 }}>{label}</p>
        {detail && <p style={{ fontSize: 13, color: C.textFaint, lineHeight: 1.5 }}>{detail}</p>}
      </div>
    </div>
  )
}

/**
 * A proportion, drawn. Used for the fairness page, where the shape of the
 * distribution is the finding — a table of percentages makes you do the
 * comparison in your head.
 */
export function Bar({ value, max, tone = 'accent' }: {
  value: number
  max: number
  tone?: 'accent' | 'caution' | 'positive'
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  const color = tone === 'caution' ? state.caution : tone === 'positive' ? state.positive : C.accent
  return (
    <div style={{ height: 7, borderRadius: R.pill, background: C.borderFaint, overflow: 'hidden', minWidth: 60 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: R.pill }} />
    </div>
  )
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: 34 }}>
      <p style={{ fontSize: 15, color: C.textFaint, textAlign: 'center', lineHeight: 1.6 }}>{children}</p>
    </div>
  )
}

export const tableStyles = {
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 14 },
  th: {
    textAlign: 'left' as const, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em',
    textTransform: 'uppercase' as const, color: C.textGhost, padding: '0 14px 9px 0',
    borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' as const,
  },
  td: {
    padding: '11px 14px 11px 0', borderBottom: `1px solid ${C.borderFaint}`,
    color: C.textSub, verticalAlign: 'top' as const,
  },
  num: { fontVariantNumeric: 'tabular-nums' as const },
} satisfies Record<string, React.CSSProperties | object>

export { T }
