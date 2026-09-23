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

/**
 * The block almost every page opens with: a back link, a heading, and a line
 * of context under it.
 *
 * Added because nine of the ten skeletons in this app were drawing their
 * cards and no header at all, so the whole page jumped down by the height of
 * a title the moment the data landed. A skeleton whose layout differs from
 * what arrives is worse than no skeleton — the eye settles on a shape and
 * then has to start again.
 */
export function HeaderSkeleton({ back, title = 240, sub = 300, gap = 20 }: {
  /** Pages reached from somewhere else open with a back link. */
  back?: boolean
  title?: number
  /** The line under the heading, or false on pages that have none. */
  sub?: number | false
  gap?: number
}) {
  return (
    <div style={{ marginBottom: gap }}>
      {back && <Bar width={96} height={11} style={{ marginBottom: 14 }} />}
      <Bar width={title} height={28} style={{ marginBottom: sub === false ? 0 : 9 }} />
      {sub !== false && <Bar width={sub} height={13} />}
    </div>
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
