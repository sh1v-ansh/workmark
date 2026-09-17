import { Bar, CardSkeleton } from '@/components/ui/Skeleton'

/**
 * One project, while it loads.
 *
 * Shaped like the page it stands in for, in the order that page actually
 * renders: project header, Today, the week, then the board. A skeleton whose
 * layout differs from what arrives makes the content jump when it lands,
 * which is worse than no skeleton — the eye settles on a shape and then has
 * to start again.
 *
 * This is the heaviest read in the product and the page a student opens most
 * days, so it is worth matching properly rather than approximating with three
 * grey rectangles.
 */
export default function Loading() {
  return (
    <main className="wm-app-ground" style={{ minHeight: '100vh', padding: '32px 24px 72px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        {/* Project name, then the repo line under it. */}
        <Bar width={280} height={30} style={{ marginBottom: 9 }} />
        <Bar width={200} height={13} style={{ marginBottom: 26 }} />

        {/* Today: a heading and three rows. */}
        <Bar width={54} height={11} style={{ marginBottom: 9 }} />
        <div style={{ display: 'grid', gap: 6, marginBottom: 18 }}>
          <Bar height={38} radius={10} />
          <Bar height={38} radius={10} style={{ opacity: 0.8 }} />
          <Bar height={38} radius={10} style={{ opacity: 0.6 }} />
        </div>

        {/* The week bar. */}
        <Bar height={62} radius={10} style={{ marginBottom: 18 }} />

        {/* Board heading and the view toggle beside it. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <Bar width={92} height={22} />
          <Bar width={68} height={22} radius={7} />
        </div>

        {/* Six columns, at the width they really are, with the left three
            fuller — an empty board is rare and a uniform grid reads as a
            loading state that knows nothing about the page. */}
        <div style={{ display: 'flex', gap: 12, overflow: 'hidden' }}>
          {[3, 2, 2, 1, 1, 0].map((cards, i) => (
            <div key={i} style={{ flex: '0 0 210px' }}>
              <Bar width={84} height={11} style={{ marginBottom: 10 }} />
              <div style={{ display: 'grid', gap: 8 }}>
                {Array.from({ length: cards }).map((_, j) => (
                  <CardSkeleton key={j} lines={2} height={82} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
