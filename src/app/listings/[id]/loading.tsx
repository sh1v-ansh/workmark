import { Bar, CardSkeleton, HeaderSkeleton } from '@/components/ui/Skeleton'
import { LAYOUT } from '@/lib/theme/layout'

/**
 * One posting, while it loads.
 *
 * The split was right and everything above it was missing: a back link, the
 * title block, and the band that says how well this posting fits you. That is
 * about 90px of page, so the brief appeared and then slid down.
 *
 * The left column is prose rather than a card, so it is drawn as lines rather
 * than as a bordered block.
 */
export default function Loading() {
  return (
    <div style={{ padding: '30px 28px 72px', maxWidth: LAYOUT.maxWidth, margin: '0 auto' }}>
      <div style={{ maxWidth: 750 }}>
        <HeaderSkeleton back title={330} sub={290} gap={23} />
      </div>

      {/* How you match what they asked for. */}
      <div style={{ background: '#FFFFFF', borderRadius: 13, border: '1px solid rgba(97,66,245,0.5)', padding: '24px 27px', marginBottom: 23 }}>
        <Bar width={200} height={18} style={{ marginBottom: 12 }} />
        <Bar width="70%" height={13} />
      </div>

      <div className="nb-split">
        <div>
          <Bar width={68} height={11} style={{ marginBottom: 12 }} />
          {[92, 97, 88, 95, 61].map((w, i) => (
            <Bar key={i} width={`${w}%`} style={{ marginBottom: 11 }} />
          ))}
        </div>
        <CardSkeleton lines={4} height={260} />
      </div>
    </div>
  )
}
