import { Bar, CardSkeleton } from '@/components/ui/Skeleton'

/**
 * The board, while it loads.
 *
 * Only the board. The name, the status and the tabs are in the layout now,
 * which Next renders once and keeps mounted — so they are already on screen
 * when this shows, and a skeleton that drew them again would put two project
 * names on the page for a moment.
 *
 * Shaped like what arrives, in the order it arrives. A skeleton whose layout
 * differs from the real thing makes the content jump when it lands, which is
 * worse than no skeleton — the eye settles on a shape and has to start again.
 */
export default function Loading() {
  return (
    <div>
      {/* The toolbar above the columns. */}
      <Bar height={40} radius={10} style={{ marginBottom: 14 }} />

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
  )
}
