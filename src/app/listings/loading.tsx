import { CardSkeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div style={{ padding: '32px 24px', maxWidth: 1120, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14.5 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <CardSkeleton key={i} lines={2} />
      ))}
    </div>
  )
}
