import { CardSkeleton, Bar } from '@/components/ui/Skeleton'
import { LAYOUT } from '@/lib/theme/layout'

/** The page's shape, drawn while the server reads it. Without this the route
 *  shows nothing at all until every query returns, and a blank page reads as
 *  a broken one. */
export default function Loading() {
  return (
    <div style={{ padding: '30px 28px 72px', maxWidth: LAYOUT.maxWidth, margin: '0 auto' }}>
      <Bar width={220} height={28} style={{ marginBottom: 10 }} />
      <Bar width="55%" height={14} style={{ marginBottom: 30 }} />
      <div style={{ display: 'grid', gap: 12 }}>
        <CardSkeleton lines={3} />
        <CardSkeleton lines={3} />
        <CardSkeleton lines={2} />
      </div>
    </div>
  )
}
