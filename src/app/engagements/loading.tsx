import { CardSkeleton, HeaderSkeleton } from '@/components/ui/Skeleton'
import { LAYOUT } from '@/lib/theme/layout'

/**
 * An engagement, while it loads.
 *
 * There is no /engagements index, so this only ever stands in for one
 * engagement. It is a stage bar across the top and then a two-to-one split —
 * the brief and the task on the left, the settings rail on the right — and
 * the skeleton was drawing one column of three cards.
 */
export default function Loading() {
  return (
    <div style={{ padding: '30px 28px 72px', maxWidth: LAYOUT.maxWidth, margin: '0 auto' }}>
      <HeaderSkeleton back title={300} sub={250} gap={18} />

      {/* Where this has got to. */}
      <CardSkeleton lines={1} height={86} />

      <div className="nb-split" style={{ marginTop: 18 }}>
        <div style={{ display: 'grid', gap: 18 }}>
          <CardSkeleton lines={5} height={280} />
          <CardSkeleton lines={3} height={190} />
        </div>
        <CardSkeleton lines={3} height={220} />
      </div>
    </div>
  )
}
