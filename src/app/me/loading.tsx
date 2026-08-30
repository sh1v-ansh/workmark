import { CardSkeleton } from '@/components/ui/Skeleton'
import { LAYOUT } from '@/lib/theme/layout'

export default function Loading() {
  return (
    <>
      <div className="nb-g3" style={{ padding: '30px 28px 72px', maxWidth: LAYOUT.maxWidth, margin: '0 auto' }}>
        <div className="nb-s2">
          <CardSkeleton lines={5} height={260} />
        </div>
        <CardSkeleton lines={3} />
      </div>
    </>
  )
}
