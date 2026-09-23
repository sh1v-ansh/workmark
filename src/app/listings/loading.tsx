import { Bar, CardSkeleton, HeaderSkeleton } from '@/components/ui/Skeleton'
import { LAYOUT } from '@/lib/theme/layout'

/**
 * Find work, while it loads.
 *
 * It was five full-width cards in one column. The page is a 230px filter rail
 * and a two-column grid, so everything on it moved sideways and up the moment
 * the data landed. The written projects now sit in that same grid rather than
 * in a section of their own, so this is one homogeneous grid too.
 */
export default function Loading() {
  return (
    <div style={{ padding: '30px 28px 72px', maxWidth: LAYOUT.maxWidth, margin: '0 auto' }}>
      <HeaderSkeleton title={190} sub={260} />

      <div style={{ display: 'grid', gridTemplateColumns: '230px minmax(0, 1fr)', gap: 22, alignItems: 'start' }} className="mob-1col">
        {/* The facet rail: a heading and four groups of chips. */}
        <div style={{ background: '#FFFFFF', borderRadius: 13, padding: '15px 17px 18px', boxShadow: '0 1px 2px rgba(25,30,46,0.04), 0 6px 18px -12px rgba(25,30,46,0.16)' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ marginBottom: i === 3 ? 0 : 17 }}>
              <Bar width={78} height={11} style={{ marginBottom: 9 }} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {Array.from({ length: 3 }).map((_, j) => (
                  <Bar key={j} width={54 + j * 14} height={25} radius={999} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14.5 }} className="mob-1col">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} lines={2} height={168} />
          ))}
        </div>
      </div>
    </div>
  )
}
