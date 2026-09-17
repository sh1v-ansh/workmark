import { Bar, CardSkeleton, HeaderSkeleton } from '@/components/ui/Skeleton'
import { LAYOUT } from '@/lib/theme/layout'

/**
 * Your file, while it loads.
 *
 * Three figures across the top, then a sticky section nav beside a reading
 * column. The skeleton drew full-width cards straight under the header, so
 * the whole page reflowed into two columns the moment it arrived.
 */
export default function Loading() {
  return (
    <div style={{ padding: '30px 28px 72px', maxWidth: LAYOUT.maxWidth, margin: '0 auto' }}>
      <HeaderSkeleton back title={220} sub={330} gap={16} />

      {/* Download, share, print. */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 30 }}>
        {[104, 92, 80].map((w) => <Bar key={w} width={w} height={34} radius={9} />)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 13, marginBottom: 30 }} className="mob-1col">
        {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} lines={1} height={104} />)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px minmax(0, 1fr)', gap: 29, alignItems: 'start' }} className="mob-1col">
        <div style={{ display: 'grid', gap: 9 }}>
          {Array.from({ length: 5 }).map((_, i) => <Bar key={i} width={i % 2 ? 132 : 158} height={13} />)}
        </div>
        <div style={{ display: 'grid', gap: 18, maxWidth: 670 }}>
          <CardSkeleton lines={4} height={240} />
          <CardSkeleton lines={4} height={240} />
        </div>
      </div>
    </div>
  )
}
