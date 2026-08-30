import { CardSkeleton } from '@/components/ui/Skeleton'
import { LAYOUT } from '@/lib/theme/layout'

export default function Loading() {
  return (
    <>
      <div style={{ padding: '30px 28px 72px', maxWidth: LAYOUT.maxWidth, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14.5 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <CardSkeleton key={i} lines={2} />
        ))}
      </div>
    </>
  )
}
