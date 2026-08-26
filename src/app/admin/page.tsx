import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/guard'
import { loadQueue } from '@/lib/admin/queue'
import { loadOverview, loadCalibration } from '@/lib/admin/stats'
import AdminShell from './AdminShell'
import { StatGrid, Panel, HealthRow } from './widgets'

/**
 * /admin — what's happening, and what's wrong.
 *
 * Deliberately answers those two questions and nothing else. Every number
 * here either means someone is waiting, something is broken, or the platform
 * is growing; anything that's merely interesting belongs on a section page.
 */
export default async function AdminOverviewPage() {
  const { admin } = await requireAdmin()

  const [overview, { items, failedSources }, calibration] = await Promise.all([
    loadOverview(admin),
    loadQueue(admin),
    loadCalibration(admin),
  ])

  const overdue = items.filter((i) => i.severity === 'overdue').length
  const onPercentile = calibration.filter((c) => c.method === 'percentile').length

  return (
    <AdminShell
      title="Overview"
      lede="What's happening on the platform, and anything that needs a person."
      queueCount={items.length}
      overdueCount={overdue}
    >
      <StatGrid
        stats={[
          { label: 'Students', value: overview.students },
          { label: 'Faculty', value: overview.faculty, note: overview.unverifiedFaculty > 0 ? `${overview.unverifiedFaculty} unverified` : undefined },
          { label: 'Open projects', value: overview.openListings },
          { label: 'Live engagements', value: overview.liveEngagements },
        ]}
      />

      <div className="nb-split" style={{ marginTop: 22 }}>
        <Panel
          title="Waiting on a person"
          action={{ href: '/admin/queue', label: items.length > 0 ? 'Open the queue' : 'View queue' }}
        >
          {items.length === 0 ? (
            <HealthRow state="ok" label="Nothing waiting" detail="The queue is clear." />
          ) : (
            <>
              {overdue > 0 && (
                <HealthRow
                  state="bad"
                  label={`${overdue} past a deadline`}
                  detail="Disputes carry a 30-day legal clock."
                />
              )}
              <HealthRow
                state={overdue > 0 ? 'warn' : 'info'}
                label={`${items.length} item${items.length === 1 ? '' : 's'} in the queue`}
                detail={summarise(items.map((i) => i.kind))}
              />
            </>
          )}
          {failedSources.length > 0 && (
            <HealthRow
              state="bad"
              label="Some sources could not be read"
              detail={`${failedSources.join(', ')} — the queue is incomplete.`}
            />
          )}
        </Panel>

        <Panel title="System">
          <HealthRow
            state={overview.failedScans > 0 ? 'warn' : 'ok'}
            label={overview.failedScans > 0 ? `${overview.failedScans} failed scans` : 'Scans healthy'}
            detail={`${overview.scansLast7Days} run in the last 7 days`}
          />
          <HealthRow
            state="info"
            label={`${overview.evidenceRows} evidence rows`}
            detail={`${onPercentile} of ${calibration.length} skills scored against real peers`}
          />
          <HealthRow
            state="info"
            label="Levels capped at 3"
            detail="Advanced and Expert need attestation, which isn't built yet."
          />
        </Panel>
      </div>

      <p style={{ fontSize: 13, color: '#8D94A5', marginTop: 22, lineHeight: 1.6 }}>
        Reading someone&apos;s record from here is logged against them, the same as any other
        access. See the <Link href="/admin/audit" style={{ color: '#4E2FD6' }}>audit log</Link>.
      </p>
    </AdminShell>
  )
}

/** "3 disputes, 2 unmatched skills" — what the queue is made of, in words. */
function summarise(kinds: string[]): string {
  const counts = new Map<string, number>()
  for (const k of kinds) counts.set(k, (counts.get(k) ?? 0) + 1)
  const LABEL: Record<string, [string, string]> = {
    dispute: ['dispute', 'disputes'],
    review_request: ['submission to review', 'submissions to review'],
    faculty_verification: ['faculty to verify', 'faculty to verify'],
    unresolved_skill: ['unmatched skill', 'unmatched skills'],
    failed_job: ['failed scan', 'failed scans'],
  }
  return Array.from(counts.entries())
    .map(([k, n]) => `${n} ${LABEL[k]?.[n === 1 ? 0 : 1] ?? k}`)
    .join(', ')
}
