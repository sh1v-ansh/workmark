import { Bar, CardSkeleton, HeaderSkeleton } from '@/components/ui/Skeleton'

/**
 * Project briefs, while they load.
 *
 * The width is the fix that matters: this was drawing at the app's full 1320
 * and the page is 680, so every line on it shrank by half the screen when the
 * data arrived. The generator panel at the top is the other half — it is the
 * biggest thing on the page and the skeleton did not have it.
 */
export default function Loading() {
  return (
    <div style={{ padding: '30px 28px 72px', maxWidth: 680, margin: '0 auto' }}>
      <HeaderSkeleton back title={230} sub={380} gap={23} />

      {/* The generator: a search box and a row of levels to pick from. */}
      <div style={{ background: '#FFFFFF', borderRadius: 13, border: '1px solid rgba(97,66,245,0.5)', padding: 21, marginBottom: 23 }}>
        <Bar width={180} height={17} style={{ marginBottom: 12 }} />
        <Bar height={40} radius={10} style={{ marginBottom: 16 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(126px, 1fr))', gap: 9 }}>
          {Array.from({ length: 3 }).map((_, i) => <Bar key={i} height={62} radius={10} />)}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        <CardSkeleton lines={3} />
        <CardSkeleton lines={2} />
      </div>
    </div>
  )
}
