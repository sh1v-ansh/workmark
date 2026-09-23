import { requireAdmin } from '@/lib/admin/guard'
import { loadQueue } from '@/lib/admin/queue'
import { loadFunnel } from '@/lib/admin/stats'
import { loadFunnelEvents } from '@/lib/admin/load-events'
import { buildFunnel, buildCohorts, worstDrop } from '@/lib/admin/funnel'
import AdminShell from '../AdminShell'
import { Panel, Bar, HealthRow } from '../widgets'
import { tableStyles as ts } from '../table-styles'
import { C, state } from '@/lib/theme/dark-tokens'

export const metadata = { title: 'Growth' }

/**
 * /admin/growth — is the product doing its job?
 *
 * Two questions carry the page. Are students getting matched at all, and does
 * the loop repeat. Everything else is context for those, and is sized
 * accordingly — a wall of equal-weight numbers is how a dashboard becomes
 * something nobody opens twice.
 */
export default async function AdminGrowthPage() {
  const { admin } = await requireAdmin()
  const [{ funnel, health, enoughData }, { items }, events] = await Promise.all([
    loadFunnel(admin),
    loadQueue(admin),
    loadFunnelEvents(admin),
  ])

  // The measured funnel, as opposed to the one derived from row counts. The
  // old one has no failures in it: somebody who opened the signup form and
  // left leaves no row in any table, so its top step is "accounts that
  // exist" and the question "how many invited people never finish" cannot be
  // asked of it at all.
  const measured = buildFunnel(events)
  const leak = worstDrop(measured)
  const cohorts = buildCohorts(events, [
    'signup_submitted', 'onboarding_completed', 'github_connected', 'first_evidence',
  ]).slice(0, 8)
  const measuredTop = measured[0]?.reached ?? 0

  const top = funnel[0]?.count ?? 0
  const matched = funnel.find((f) => f.label === 'Got accepted')?.count ?? 0
  const repeated = funnel.find((f) => f.label === 'Did a second')?.count ?? 0
  const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '—')

  return (
    <AdminShell
      title="Growth"
      lede="Whether students are getting real work, and whether they come back for more."
      queueCount={items.length}
      overdueCount={items.filter((i) => i.severity === 'overdue').length}
    >
      {!enoughData && (
        <div style={{ background: state.infoBg, borderRadius: 9, padding: '13px 17px', marginBottom: 22 }}>
          <p style={{ fontSize: 13.5, color: state.info, lineHeight: 1.6 }}>
            Not enough people yet for these percentages to mean anything — with {top} account
            {top === 1 ? '' : 's'}, one person moving changes every number below by a lot. The
            counts are real; treat the rates as noise until there are a few dozen.
          </p>
        </div>
      )}

      {/* The two that matter, at the size that says so. */}
      <div className="nb-split" style={{ marginBottom: 24 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 13, padding: '20px 22px' }}>
          <p style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.textGhost, marginBottom: 8 }}>
            Students who got real work
          </p>
          <p style={{ fontSize: 38, fontWeight: 600, letterSpacing: '-0.022em', color: C.text, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {matched}<span style={{ fontSize: 20, color: C.textGhost, fontWeight: 600 }}> / {top}</span>
          </p>
          <p style={{ fontSize: 13.5, color: C.textFaint, marginTop: 8, lineHeight: 1.55 }}>
            {pct(matched, top)} of everyone who signed up. If this is near zero, nothing else on
            this page matters.
          </p>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 13, padding: '20px 22px' }}>
          <p style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.textGhost, marginBottom: 8 }}>
            Came back for a second
          </p>
          <p style={{ fontSize: 38, fontWeight: 600, letterSpacing: '-0.022em', color: C.text, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {repeated}
          </p>
          <p style={{ fontSize: 13.5, color: C.textFaint, marginTop: 8, lineHeight: 1.55 }}>
            The whole thesis in one number. People who do a second project believe the record is
            worth building.
          </p>
        </div>
      </div>

      {/* Measured, not derived. Above the old table because it can see the
          step the old one cannot: people who never became a row. */}
      <div style={{ marginBottom: 24 }}>
        <Panel title="Where people stop — measured">
          {measuredTop === 0 ? (
            <p style={{ fontSize: 13.5, color: C.textFaint, lineHeight: 1.6 }}>
              No events recorded yet. This fills in as people arrive — it starts at the signup
              form rather than at accounts that exist, so it can show the ones who never
              finished.
            </p>
          ) : (
            <>
              {leak && (
                <div style={{ background: state.cautionBg, borderRadius: 9, padding: '12px 15px', marginBottom: 16 }}>
                  <p style={{ fontSize: 13.5, color: state.caution, lineHeight: 1.6 }}>
                    Biggest drop is <strong>{leak.name}</strong> — {Math.round(leak.ofPrevious! * 100)}%
                    of the people above it get through. That is the screen to look at.
                  </p>
                </div>
              )}
              <div style={{ overflowX: 'auto' }}>
                <table style={ts.table}>
                  <thead>
                    <tr>
                      <th style={ts.th}>Step</th>
                      <th style={ts.th}>People</th>
                      <th style={ts.th}></th>
                      <th style={ts.th}>Of previous</th>
                      <th style={ts.th}>Of everyone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {measured.map((f) => {
                      const leaky = f.ofPrevious !== null && f.ofPrevious < 0.5
                      return (
                        <tr key={f.event}>
                          <td style={{ ...ts.td, fontWeight: 600, color: C.text, whiteSpace: 'nowrap' }}>{f.name}</td>
                          <td style={{ ...ts.td, ...ts.num }}>{f.reached}</td>
                          <td style={{ ...ts.td, minWidth: 110 }}><Bar value={f.reached} max={measuredTop} /></td>
                          <td style={{ ...ts.td, ...ts.num, color: leaky ? state.caution : C.textSub, fontWeight: leaky ? 700 : 400 }}>
                            {f.ofPrevious === null ? '—' : `${Math.round(f.ofPrevious * 100)}%`}
                          </td>
                          <td style={{ ...ts.td, ...ts.num, color: C.textFaint }}>
                            {f.ofStart === null ? '—' : `${Math.round(f.ofStart * 100)}%`}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>
      </div>

      {/* By week, because a single all-time number moves too slowly to tell
          you whether the thing you changed on Tuesday worked. */}
      {cohorts.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <Panel title="By the week they arrived">
            <div style={{ overflowX: 'auto' }}>
              <table style={ts.table}>
                <thead>
                  <tr>
                    <th style={ts.th}>Week of</th>
                    <th style={ts.th}>Arrived</th>
                    <th style={ts.th}>Submitted</th>
                    <th style={ts.th}>Finished profile</th>
                    <th style={ts.th}>Connected GitHub</th>
                    <th style={ts.th}>First skill</th>
                  </tr>
                </thead>
                <tbody>
                  {cohorts.map((c) => (
                    <tr key={c.week}>
                      <td style={{ ...ts.td, fontWeight: 600, color: C.text, whiteSpace: 'nowrap' }}>{c.week}</td>
                      <td style={{ ...ts.td, ...ts.num }}>{c.size}</td>
                      <td style={{ ...ts.td, ...ts.num }}>{c.reached.signup_submitted ?? 0}</td>
                      <td style={{ ...ts.td, ...ts.num }}>{c.reached.onboarding_completed ?? 0}</td>
                      <td style={{ ...ts.td, ...ts.num }}>{c.reached.github_connected ?? 0}</td>
                      <td style={{ ...ts.td, ...ts.num }}>{c.reached.first_evidence ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 12.5, color: C.textGhost, lineHeight: 1.55, marginTop: 11 }}>
              Somebody is counted in the week they first appeared, and in a later column if they
              ever reached it — not only if they reached it that week.
            </p>
          </Panel>
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <Panel title="Where people stop — from row counts">
          <div style={{ overflowX: 'auto' }}>
            <table style={ts.table}>
              <thead>
                <tr>
                  <th style={ts.th}>Step</th>
                  <th style={ts.th}>People</th>
                  <th style={ts.th}></th>
                  <th style={ts.th}>Of previous</th>
                  <th style={ts.th}>If they stop here</th>
                </tr>
              </thead>
              <tbody>
                {funnel.map((f) => {
                  // A step losing more than half is where the work is.
                  const leaky = f.conversion !== null && f.conversion < 0.5 && enoughData
                  return (
                    <tr key={f.label}>
                      <td style={{ ...ts.td, fontWeight: 600, color: C.text, whiteSpace: 'nowrap' }}>{f.label}</td>
                      <td style={{ ...ts.td, ...ts.num }}>{f.count}</td>
                      <td style={{ ...ts.td, minWidth: 110 }}><Bar value={f.count} max={top} /></td>
                      <td style={{ ...ts.td, ...ts.num, color: leaky ? state.caution : C.textSub, fontWeight: leaky ? 700 : 400 }}>
                        {f.conversion === null ? '—' : `${Math.round(f.conversion * 100)}%`}
                      </td>
                      <td style={{ ...ts.td, fontSize: 13, color: C.textFaint, lineHeight: 1.5 }}>{f.meaning}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Panel title="Health">
        <HealthRow
          state={health.decisionRate === null ? 'info' : health.decisionRate < 0.8 ? 'bad' : 'ok'}
          label={health.decisionRate === null
            ? 'No applications old enough to judge yet'
            : `${Math.round(health.decisionRate * 100)}% of applications got an answer`}
          detail={health.ghosted > 0
            ? `${health.ghosted} left unanswered for over two weeks. Being ignored is what makes students stop trusting the platform — faster than a rejection ever does.`
            : 'Nobody is being left hanging.'}
        />
        <HealthRow
          state={health.readyButNotApplying > 0 ? 'warn' : 'ok'}
          label={`${health.readyButNotApplying} students have a record but have never applied`}
          detail="They did the hard part and stalled. At this size this is the leak most worth chasing."
        />
        <HealthRow
          state={health.listingsWithNoApplicants > 0 ? 'warn' : 'info'}
          label={`${health.listingsWithNoApplicants} of ${health.openListings} open projects have no applicants`}
          detail="Either too few students, or the projects are asking for more than anyone has."
        />
        <HealthRow
          state="info"
          label={health.medianDaysToDecision === null
            ? 'No decisions recorded yet'
            : `Posters answer in ${health.medianDaysToDecision.toFixed(1)} days, typically`}
          detail="Measured from applying to any decision."
        />
      </Panel>
    </AdminShell>
  )
}
