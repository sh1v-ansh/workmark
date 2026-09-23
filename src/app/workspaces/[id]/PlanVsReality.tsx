'use client'

import Card from '@/components/Card'
import { C, T } from '@/lib/theme/dark-tokens'
import { estimatorProfile, type WorkspaceMetrics, type Figure } from '@/lib/workspace/metrics'

const ROLE_LABEL: Record<string, string> = {
  backend: 'Backend', frontend: 'Frontend', fullstack: 'Full-stack', mobile: 'Mobile',
  data: 'Data', ml: 'ML / AI', infra: 'Infra', design: 'Design', other: 'Other',
}

/**
 * A figure, or an honest absence.
 *
 * Every number here carries the sample it came from, and one below the floor
 * shows what it is waiting for rather than a dash. "Needs 4 tasks" tells a
 * student the measurement is coming; a blank tells them it is broken.
 */
function Stat({ label, figure, format, hint }: {
  label: string
  figure: Figure
  format: (v: number) => string
  hint?: string
}) {
  return (
    <div>
      <p style={{ fontSize: T.meta, color: C.textFaint, marginBottom: 3 }}>{label}</p>
      {figure.value === null ? (
        <p style={{ fontSize: T.bodySm, color: C.textGhost }}>
          {figure.sample === 0 ? 'Nothing yet' : `${figure.sample} so far — needs a few more`}
        </p>
      ) : (
        <>
          <p style={{ fontSize: T.h3, fontWeight: 600, color: C.text }}>{format(figure.value)}</p>
          <p style={{ fontSize: T.meta, color: C.textGhost }}>
            from {figure.sample} task{figure.sample === 1 ? '' : 's'}
          </p>
        </>
      )}
      {hint && figure.value !== null && (
        <p style={{ fontSize: T.meta, color: C.textFaint, marginTop: 3, lineHeight: 1.45 }}>{hint}</p>
      )}
    </div>
  )
}

const percent = (v: number) => `${Math.round(v * 100)}%`
const days = (v: number) => v === 0 ? 'On the day' : v > 0 ? `${v} days late` : `${Math.abs(v)} days early`
const signed = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`

export default function PlanVsReality({
  metrics,
  computedAt,
}: {
  metrics: WorkspaceMetrics | null
  computedAt: string | null
}) {
  if (!metrics) {
    return (
      <Card style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: T.h2, fontWeight: 600, color: C.text, marginBottom: 4 }}>Plan vs reality</h2>
        <p style={{ fontSize: T.bodySm, color: C.textMuted, lineHeight: 1.6 }}>
          Nothing measured yet. This fills in once you have finished a few tasks — every figure
          comes from the board itself, so there is nothing to fill in by hand.
        </p>
      </Card>
    )
  }

  const profile = estimatorProfile(metrics.estimation.bias, metrics.estimation.spread)
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 18 } as const

  return (
    <Card style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
        <h2 style={{ fontSize: T.h2, fontWeight: 600, color: C.text }}>Plan vs reality</h2>
        {computedAt && (
          <span style={{ fontSize: T.meta, color: C.textGhost }}>
            as of {new Date(computedAt).toLocaleDateString()}
          </span>
        )}
      </div>
      <p style={{ fontSize: T.bodySm, color: C.textMuted, lineHeight: 1.6, marginBottom: 20, maxWidth: '62ch' }}>
        Your work, measured from the board rather than asked about. Nobody typed any of this.
      </p>

      <section style={{ marginBottom: 22 }}>
        <h3 style={{ fontSize: T.bodySm, fontWeight: 600, color: C.textSub, marginBottom: 11 }}>
          Doing what you said you would
        </h3>
        <div style={grid}>
          <Stat label="Finished on time" figure={metrics.execution.onTimeRate} format={percent} />
          <Stat label="Typically" figure={metrics.execution.medianDaysLate} format={days} />
          {/* The figure most worth an employer's attention: a deadline missed
              but flagged four days early beats one hit by working a weekend. */}
          <Stat
            label="Flagged a slip"
            figure={metrics.execution.earlyWarningDays}
            format={(v) => v > 0 ? `${Math.round(v)} days ahead` : 'After the date'}
            hint="How far before the deadline you said it would move"
          />
        </div>
      </section>

      <section style={{ marginBottom: 22 }}>
        <h3 style={{ fontSize: T.bodySm, fontWeight: 600, color: C.textSub, marginBottom: 11 }}>
          Estimating
        </h3>
        <div style={grid}>
          <Stat
            label="Bias"
            figure={metrics.estimation.bias}
            format={signed}
            hint="Positive means work takes longer than you plan for"
          />
          <Stat label="Spread" figure={metrics.estimation.spread} format={signed}
            hint="How far off you typically are, either direction" />
        </div>
        {profile && (
          <p style={{ fontSize: T.bodySm, color: C.textMuted, lineHeight: 1.6, marginTop: 12 }}>{profile}</p>
        )}
        {metrics.estimation.byRole.length > 1 && (
          <p style={{ fontSize: T.meta, color: C.textFaint, marginTop: 8, lineHeight: 1.6 }}>
            By kind of work:{' '}
            {metrics.estimation.byRole
              .filter((r) => r.bias.value !== null)
              .map((r) => `${ROLE_LABEL[r.role] ?? r.role} ${signed(r.bias.value!)}`)
              .join(' · ')}
          </p>
        )}
      </section>

      <section style={{ marginBottom: 22 }}>
        <h3 style={{ fontSize: T.bodySm, fontWeight: 600, color: C.textSub, marginBottom: 11 }}>
          What you can finish
        </h3>
        <div style={grid}>
          <div>
            <p style={{ fontSize: T.meta, color: C.textFaint, marginBottom: 3 }}>Hardest level you finish reliably</p>
            <p style={{ fontSize: T.h3, fontWeight: 600, color: C.text }}>
              {metrics.technical.capabilityFrontier === null
                ? 'Not enough yet'
                : `${metrics.technical.capabilityFrontier} out of 10`}
            </p>
            <p style={{ fontSize: T.meta, color: C.textGhost }}>
              {metrics.technical.completed} task{metrics.technical.completed === 1 ? '' : 's'} finished
            </p>
          </div>
          <Stat label="Passed the check first time" figure={metrics.technical.firstTryPassRate} format={percent} />
          <Stat label="Tries to pass" figure={metrics.debugging.medianAttemptsToPass}
            format={(v) => v === 1 ? 'First time' : `${v}`} />
        </div>
      </section>

      <section>
        <h3 style={{ fontSize: T.bodySm, fontWeight: 600, color: C.textSub, marginBottom: 11 }}>
          How you plan
        </h3>
        <div style={grid}>
          <Stat label="Kept the plan as drafted" figure={metrics.decomposition.acceptedAsIs} format={percent}
            hint="Editing a suggestion is not worse than keeping it — it is different" />
          <div>
            <p style={{ fontSize: T.meta, color: C.textFaint, marginBottom: 3 }}>Tasks you wrote yourself</p>
            <p style={{ fontSize: T.h3, fontWeight: 600, color: C.text }}>{metrics.decomposition.studentCreated}</p>
            <p style={{ fontSize: T.meta, color: C.textGhost }}>
              {metrics.decomposition.aiEdited} suggested then reshaped
            </p>
          </div>
          <div>
            <p style={{ fontSize: T.meta, color: C.textFaint, marginBottom: 3 }}>Times you said why something changed</p>
            <p style={{ fontSize: T.h3, fontWeight: 600, color: C.text }}>{metrics.estimation.reasonsGiven}</p>
            <p style={{ fontSize: T.meta, color: C.textGhost }}>
              across {metrics.execution.renegotiations} deadline change{metrics.execution.renegotiations === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      </section>
    </Card>
  )
}
