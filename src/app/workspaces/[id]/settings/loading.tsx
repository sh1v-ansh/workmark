import { CardSkeleton } from '@/components/ui/Skeleton'

/**
 * Three cards, which is what settings is.
 *
 * Present so that clicking the tab does something immediately. Without a
 * boundary here Next holds the old page on screen until the new one's data
 * lands, and a tab that highlights but does not change looks broken.
 */
export default function Loading() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <CardSkeleton lines={3} height={150} />
      <CardSkeleton lines={2} height={130} />
      <CardSkeleton lines={4} height={220} />
    </div>
  )
}
