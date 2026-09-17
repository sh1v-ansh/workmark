import { CardSkeleton, HeaderSkeleton } from '@/components/ui/Skeleton'
import { LAYOUT } from '@/lib/theme/layout'

/**
 * The dashboard, while it loads.
 *
 * Three bands, because the page has three: the thing that needs you with its
 * rail beside it, then the record and the nudge side by side, then the strip
 * of postings. It used to draw only the first band and no header, so two
 * thirds of the page appeared from nowhere and the whole thing jumped down
 * by the height of a heading.
 */
export default function Loading() {
  return (
    <div style={{ padding: '30px 28px 72px', maxWidth: LAYOUT.maxWidth, margin: '0 auto' }}>
      <HeaderSkeleton title={280} sub={230} />

      {/* The lead item, with the two smaller ones stacked beside it. The
          focal card spans both rows, so the rail cards are direct children
          of the grid rather than a nested column. */}
      <div className="nb-g3" style={{ marginBottom: 18 }}>
        <div className="nb-s2" style={{ gridRow: 'span 2' }}>
          <CardSkeleton lines={4} height={324} />
        </div>
        <CardSkeleton lines={2} height={154} />
        <CardSkeleton lines={2} height={154} />
      </div>

      {/* The record, and the panel that suggests what to build next. */}
      <div className="nb-g2" style={{ marginBottom: 18 }}>
        <CardSkeleton lines={4} height={250} />
        <CardSkeleton lines={3} height={250} />
      </div>

      {/* Your postings. */}
      <CardSkeleton lines={3} height={190} />
    </div>
  )
}
