import { CardSkeleton, HeaderSkeleton } from '@/components/ui/Skeleton'
import { LAYOUT } from '@/lib/theme/layout'

/**
 * Goals, while they load.
 *
 * The hero is the page — a two-thirds focal panel with two figures stacked
 * beside it — and the skeleton was drawing three cards in a column with a
 * subtitle bar for a subtitle the page does not have.
 */
export default function Loading() {
  return (
    <div style={{ padding: '30px 28px 72px', maxWidth: LAYOUT.maxWidth, margin: '0 auto' }}>
      <HeaderSkeleton title={250} sub={false} gap={23} />

      <div className="nb-g3" style={{ marginBottom: 23 }}>
        <div className="nb-s2">
          <CardSkeleton lines={4} height={268} />
        </div>
        <div style={{ display: 'grid', gap: 14.5 }}>
          <CardSkeleton lines={1} height={127} />
          <CardSkeleton lines={1} height={127} />
        </div>
      </div>

      {/* What to build next, three across. */}
      <div className="nb-g3">
        {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} lines={3} height={210} />)}
      </div>
    </div>
  )
}
