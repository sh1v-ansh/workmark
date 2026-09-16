import { Bar, CardSkeleton } from '@/components/ui/Skeleton'

/**
 * One project, while the board loads.
 *
 * This page is the heaviest read in the product — tasks, verdicts, members,
 * dependencies, decisions and metrics — and it is the one a student opens
 * most days. It was the longest blank screen in Workmark.
 *
 * The six columns are drawn at their real width rather than as one grey
 * block, so the board does not reflow into place when it arrives.
 */
export default function Loading() {
  return (
    <main className="wm-app-ground" style={{ minHeight: '100vh', padding: '32px 24px 72px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <Bar width={260} height={30} style={{ marginBottom: 10 }} />
        <Bar width="45%" height={14} style={{ marginBottom: 30 }} />

        <div style={{ display: 'flex', gap: 12, overflow: 'hidden', marginBottom: 28 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ flex: '0 0 210px' }}>
              <Bar width={90} height={12} style={{ marginBottom: 12 }} />
              <div style={{ display: 'grid', gap: 8 }}>
                <CardSkeleton lines={2} height={78} />
                {i < 3 && <CardSkeleton lines={2} height={78} />}
              </div>
            </div>
          ))}
        </div>

        <CardSkeleton lines={4} />
      </div>
    </main>
  )
}
