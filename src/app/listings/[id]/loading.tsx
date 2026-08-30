import { CardSkeleton } from '@/components/ui/Skeleton'
import { LAYOUT } from '@/lib/theme/layout'

export default function Loading() {
  return (
    <>
      <div className="nb-split" style={{ padding: '30px 28px 72px', maxWidth: LAYOUT.maxWidth, margin: '0 auto' }}>
        <CardSkeleton lines={6} height={320} />
        <CardSkeleton lines={3} />
      </div>
    </>
  )
}
