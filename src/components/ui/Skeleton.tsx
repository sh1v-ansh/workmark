'use client'

import { C, R } from '@/lib/theme/dark-tokens'

/**
 * A shimmering placeholder bar — the thing a `loading.tsx` renders while its
 * page's server component is still doing its round trips to Supabase. Not
 * decorative: without a route's `loading.tsx`, Next.js shows nothing at all
 * until every await on the page resolves, which on a nav is exactly the
 * "click and it just sits there" complaint. This is what fills that gap.
 */
export function Bar({ width = '100%', height = 14, radius = R.sm, style }: {
  width?: number | string
  height?: number
  radius?: number
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: `linear-gradient(90deg, ${C.borderFaint} 25%, ${C.border} 37%, ${C.borderFaint} 63%)`,
        backgroundSize: '400% 100%',
        animation: 'nb-shimmer 1.4s ease infinite',
        ...style,
      }}
    />
  )
}

/** A skeleton shaped like an `.nb-card` — the unit most pages are built from. */
export function CardSkeleton({ lines = 3, height }: { lines?: number; height?: number }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: 19.5, height }}>
      <Bar width="45%" height={16} style={{ marginBottom: 14 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <Bar key={i} width={i === lines - 1 ? '65%' : '90%'} style={{ marginBottom: i === lines - 1 ? 0 : 10 }} />
      ))}
    </div>
  )
}
