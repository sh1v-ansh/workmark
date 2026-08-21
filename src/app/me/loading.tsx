import { CardSkeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="nb-g3" style={{ padding: '32px 24px', maxWidth: 1120, margin: '0 auto' }}>
      <div className="nb-s2">
        <CardSkeleton lines={5} height={260} />
      </div>
      <CardSkeleton lines={3} />
    </div>
  )
}
