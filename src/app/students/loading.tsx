import { Bar, CardSkeleton, HeaderSkeleton } from '@/components/ui/Skeleton'
import { LAYOUT } from '@/lib/theme/layout'

/**
 * The student directory, while it loads.
 *
 * A grid that fills to the width, not a column of three. The opt-in card and
 * the search box above it are the two things between the heading and the
 * grid, and leaving them out moved every card up by about 110px.
 */
export default function Loading() {
  return (
    <div style={{ padding: '30px 28px 72px', maxWidth: LAYOUT.maxWidth, margin: '0 auto' }}>
      <HeaderSkeleton title={240} sub={420} />

      <CardSkeleton lines={1} height={78} />
      <Bar height={40} radius={10} style={{ margin: '18px 0' }} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 13 }}>
        {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} lines={2} height={158} />)}
      </div>
    </div>
  )
}
