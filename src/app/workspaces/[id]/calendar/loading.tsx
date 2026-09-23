import { Bar } from '@/components/ui/Skeleton'

/** See settings/loading.tsx — a tab that highlights but does not change looks broken. */
export default function Loading() {
  return (
    <div>
      <Bar height={40} radius={10} style={{ marginBottom: 14 }} />
      <Bar height={420} radius={12} />
    </div>
  )
}
