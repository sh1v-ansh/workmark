import { CardSkeleton } from '@/components/ui/Skeleton'

/** See settings/loading.tsx — a tab that highlights but does not change looks broken. */
export default function Loading() {
  return <CardSkeleton lines={5} height={320} />
}
