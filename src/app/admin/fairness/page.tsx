import { requireAdmin } from '@/lib/admin/guard'
import { loadQueue } from '@/lib/admin/queue'
import { loadFairness, loadCalibration } from '@/lib/admin/stats'
import AdminShell from '../AdminShell'
import { Panel, Bar, EmptyState } from '../widgets'
import { C, state } from '@/lib/theme/dark-tokens'
import { tableStyles as ts } from '../table-styles'

const TIER_LABEL: Record<string, string> = {
  strong_fit: 'Strong fit',
  competitive: 'Competitive',
  reach: 'Reach',
  not_yet: 'Not yet',
}

/**
 * /admin/fairness — what the fit tiers are actually doing.
 *
 * Every tier shown to every student has been recorded since the platform
 * started and nothing had ever read it. The audit it exists for had never
 * run.
 *
 * The question it answers: is the tier informing a decision, or making it?
 * If almost nobody shown "reach" ever applies, the label is filtering people
 * out before they choose — which is the configuration most exposed to a
 * fairness challenge, and the one your own spec says to keep watching.
 */
export default async function AdminFairnessPage() {
  const { admin } = await requireAdmin()

  const [fairness, calibration, { items }] = await Promise.all([
    loadFairness(admin),
    loadCalibration(admin),
    loadQueue(admin),
  ])

  const maxShown = Math.max(...fairness.rows.map((r) => r.shown), 1)
  const onPercentile = calibration.filter((c) => c.method === 'percentile')

  return (
    <AdminShell
      title="Fairness & calibration"
      lede="Whether the fit tier is informing students or deciding for them, and which skills are scored against real peers."
      queueCount={items.length}
      overdueCount={items.filter((i) => i.severity === 'overdue').length}
    >
      {fairness.totalShown === 0 ? (
        <EmptyState>
          No fit tiers shown yet. This page fills in once students start viewing projects.
        </EmptyState>
      ) : (
        <>
          <div style={{ marginBottom: 22 }}>
            <Panel title={`Fit tiers shown · ${fairness.totalShown}`}>
              <div style={{ overflowX: 'auto' }}>
                <table style={ts.table}>
                  <thead>
                    <tr>
                      <th style={ts.th}>Tier</th>
                      <th style={ts.th}>Shown</th>
                      <th style={ts.th}>Distribution</th>
                      <th style={ts.th}>Then applied</th>
                      <th style={ts.th}>Apply rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fairness.rows.map((r) => {
                      // A tier almost nobody acts on is the finding: it means
                      // the label is doing the deciding.
                      const discouraging = r.shown >= 20 && r.applyRate < 0.05
                      return (
                        <tr key={r.tier}>
                          <td style={{ ...ts.td, fontWeight: 600, color: C.text }}>{TIER_LABEL[r.tier] ?? r.tier}</td>
                          <td style={{ ...ts.td, ...ts.num }}>{r.shown}</td>
                          <td style={{ ...ts.td, minWidth: 120 }}>
                            <Bar value={r.shown} max={maxShown} />
                          </td>
                          <td style={{ ...ts.td, ...ts.num }}>{r.applied}</td>
                          <td style={{ ...ts.td, ...ts.num, color: discouraging ? state.caution : C.textSub, fontWeight: discouraging ? 700 : 400 }}>
                            {Math.round(r.applyRate * 100)}%
                            {discouraging && <span style={{ fontWeight: 400 }}> · almost nobody applies</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          {fairness.missingSkillsTop.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <Panel title="Skills students most often lack">
                <p style={{ fontSize: 13.5, color: C.textFaint, lineHeight: 1.55, marginBottom: 10 }}>
                  What&apos;s standing between students and the projects they look at. A skill high
                  on this list is either a real gap worth suggesting projects for, or a requirement
                  posters ask for more than they need.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {fairness.missingSkillsTop.map((s) => (
                    <div key={s.skill} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 13.5, color: C.textSub, minWidth: 160 }}>{s.skill}</span>
                      <Bar value={s.count} max={fairness.missingSkillsTop[0].count} tone="caution" />
                      <span style={{ fontSize: 13, color: C.textGhost, ...ts.num }}>{s.count}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          )}
        </>
      )}

      <Panel title={`Level calibration · ${onPercentile.length} of ${calibration.length} on percentiles`}>
        <p style={{ fontSize: 13.5, color: C.textFaint, lineHeight: 1.55, marginBottom: 12 }}>
          A skill switches from fixed bands to real percentiles once enough students have it.
          That switch can move someone&apos;s level without them doing any new work, which is
          exactly the kind of change a student would otherwise experience as unexplained.
        </p>
        {calibration.length === 0 ? (
          <p style={{ fontSize: 14, color: C.textGhost }}>No evidence recorded yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={ts.table}>
              <thead>
                <tr>
                  <th style={ts.th}>Skill</th>
                  <th style={ts.th}>Students with it</th>
                  <th style={ts.th}>Scored by</th>
                  <th style={ts.th}>Switched</th>
                </tr>
              </thead>
              <tbody>
                {calibration.slice(0, 25).map((c) => (
                  <tr key={c.skillId}>
                    <td style={{ ...ts.td, fontWeight: 600, color: C.text }}>{c.skillName}</td>
                    <td style={{ ...ts.td, ...ts.num }}>{c.evidenceCount}</td>
                    <td style={ts.td}>
                      {c.method === 'percentile'
                        ? <span style={{ color: state.positive, fontWeight: 600 }}>real peers</span>
                        : <span style={{ color: C.textGhost }}>fixed bands</span>}
                    </td>
                    <td style={{ ...ts.td, color: C.textGhost }}>
                      {c.switchedAt ? new Date(c.switchedAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <p style={{ fontSize: 12.5, color: C.textGhost, marginTop: 20, lineHeight: 1.6, maxWidth: '64ch' }}>
        This is the honest version, not a full disparate-impact analysis — that needs demographic
        data the platform doesn&apos;t collect and shouldn&apos;t start collecting casually. What
        it can show is whether the filter is doing something extreme.
      </p>
    </AdminShell>
  )
}
