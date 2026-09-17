import { CardSkeleton } from '@/components/ui/Skeleton'
import { Bar } from '@/components/ui/Skeleton'

/**
 * The project list, while the server reads it.
 *
 * Without this the route renders nothing until three Supabase round trips
 * come back, so clicking Projects in the nav shows a blank page. A blank page
 * is indistinguishable from a broken one, and the fix is not a faster query —
 * it is showing the shape of the answer immediately.
 *
 * Deliberately the same shape as the real page: a heading, a paragraph, then
 * a stack of project cards. A skeleton whose layout differs from what lands
 * makes the content jump when it arrives, which is worse than no skeleton.
 */
export default function Loading() {
  return (
    <main className="wm-app-ground" style={{ minHeight: '100vh', padding: '32px 24px 72px' }}>
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        <Bar width={180} height={30} style={{ marginBottom: 10 }} />
        <Bar width="60%" height={14} style={{ marginBottom: 32 }} />
        <div style={{ display: 'grid', gap: 10 }}>
          <CardSkeleton lines={2} />
          <CardSkeleton lines={2} />
          <CardSkeleton lines={2} />
        </div>
      </div>
    </main>
  )
}
