import { CardSkeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <>
      <div className="nb-split" style={{ padding: '32px 24px', maxWidth: 1120, margin: '0 auto' }}>
        <CardSkeleton lines={6} height={320} />
        <CardSkeleton lines={3} />
      </div>
    </>
  )
}
