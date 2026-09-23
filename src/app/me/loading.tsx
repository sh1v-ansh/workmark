import { CardSkeleton, HeaderSkeleton } from '@/components/ui/Skeleton'
import { LAYOUT } from '@/lib/theme/layout'

/**
 * Your record, while it loads.
 *
 * The columns were the wrong way round: this drew a wide block on the left
 * and a narrow one on the right, and the page is a 330px rail on the left
 * with the wide content beside it. Everything slid across the screen when the
 * data landed.
 */
export default function Loading() {
  return (
    <div style={{ padding: '30px 28px 72px', maxWidth: LAYOUT.maxWidth, margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '330px minmax(0, 1fr)', gap: 29, alignItems: 'start' }} className="mob-1col">
        {/* The rail: who you are, how you work, and your public profile. */}
        <div style={{ display: 'grid', gap: 18 }}>
          <HeaderSkeleton title={210} sub={280} gap={0} />
          <CardSkeleton lines={2} height={132} />
          <CardSkeleton lines={3} height={168} />
          <CardSkeleton lines={2} height={124} />
        </div>

        {/* The skills, and everything they came from. */}
        <div style={{ display: 'grid', gap: 18 }}>
          <CardSkeleton lines={5} height={300} />
          <CardSkeleton lines={4} height={250} />
        </div>
      </div>
    </div>
  )
}
