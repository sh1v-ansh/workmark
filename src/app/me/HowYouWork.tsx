'use client'

import Card from '@/components/Card'
import { C, R, T } from '@/lib/theme/dark-tokens'
import { estimatorProfile, type Figure } from '@/lib/workspace/metrics'
import type { AcrossProjects } from '@/lib/workspace/across'

/**
 * How somebody works, across everything they have worked on.
 *
 * The half of the record that is not about what they know. Skills say what
 * they can build; this says whether they finish it, whether they said so when
 * it was going to slip, and how far off their own estimates run — which is
 * the part a reference call exists to get at and usually cannot.
 *
 * Every figure here is pooled from the raw rows rather than averaged from the
 * per-project ones. See across.ts for why that distinction is not pedantic.
 *
 * ── On showing samples ────────────────────────────────────────────────────
 * A figure computed from four tasks and one computed from forty are different
 * claims, and hiding which is which is how a record starts overstating. So
 * the sample sits next to every number, and anything below the floor says
 * "not enough yet" rather than showing a number that looks like knowledge.
 */

function Stat({ label, value, sample, hint }: {
  label: string
  value: string | null
  sample: number
  hint?: string
}) {
  return (
    <div>
      <p style={{ fontSize: T.meta, color: C.textFaint, marginBottom: 3 }}>{label}</p>
      {value === null ? (
        <p style={{ fontSize: T.bodySm, color: C.textGhost }}>
          Not enough yet{sample > 0 ? ` · ${sample} so far` : ''}
        </p>
      ) : (
        <>
          <p style={{ fontSize: 22, fontWeight: 600, color: C.text, lineHeight: 1.2 }}>{value}</p>
          <p style={{ fontSize: T.meta, color: C.textGhost, marginTop: 2 }}>
            {hint ? `${hint} · ` : ''}from {sample} task{sample === 1 ? '' : 's'}
          </p>
        </>
      )}
    </div>
  )
}

function percent(f: Figure): string | null {
  return f.value === null ? null : `${Math.round(f.value * 100)}%`
}

/** Signed, because the direction is the useful half. */
function bias(f: Figure): string | null {
  if (f.value === null) return null
  const pct = Math.round(f.value * 100)
  if (pct === 0) return 'About right'
  return pct > 0 ? `${pct}% under` : `${Math.abs(pct)}% over`
}

export default function HowYouWork({ data }: { data: AcrossProjects }) {
  const m = data.overall
  const profile = estimatorProfile(m.estimation.bias, m.estimation.spread)

  return (
    <Card>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: T.h3, fontWeight: 600, color: C.text, marginBottom: 3 }}>How you work</p>
        <p style={{ fontSize: T.bodySm, color: C.textMuted, lineHeight: 1.6 }}>
          Measured from {data.projectCount} project{data.projectCount === 1 ? '' : 's'}.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 18, marginBottom: 18 }}>
        <Stat
          label="Hardest level you finish reliably"
          value={m.technical.capabilityFrontier === null ? null : `${m.technical.capabilityFrontier} of 10`}
          sample={m.technical.completed}
        />
        <Stat label="Finished on time" value={percent(m.execution.onTimeRate)} sample={m.execution.onTimeRate.sample} />
        <Stat
          label="Your estimates"
          value={bias(m.estimation.bias)}
          sample={m.estimation.bias.sample}
          hint={profile ?? undefined}
        />
        <Stat label="Passed the checker first time" value={percent(m.technical.firstTryPassRate)} sample={m.technical.firstTryPassRate.sample} />
      </div>

      {/* The number most worth an employer's attention, and the one nobody
          else measures: whether a slip was announced or discovered. */}
      {m.execution.earlyWarningDays.value !== null && (
        <p style={{
          fontSize: T.bodySm, color: C.textSub, lineHeight: 1.65,
          padding: '11px 13px', borderRadius: R.md, background: C.surfaceAlt, marginBottom: 18,
        }}>
          When something was going to slip, you said so{' '}
          <strong style={{ color: C.text }}>
            {m.execution.earlyWarningDays.value} day{m.execution.earlyWarningDays.value === 1 ? '' : 's'}
          </strong>{' '}
          before the deadline on average, across {m.execution.renegotiations} renegotiation
          {m.execution.renegotiations === 1 ? '' : 's'}.
        </p>
      )}

      {/* The breakdown, because "you underestimate" and "you underestimate on
          that one project" are different claims, and the second is arguable. */}
      {data.perProject.length > 1 && (
        <div style={{ borderTop: `1px solid ${C.borderFaint}`, paddingTop: 12 }}>
          <p style={{ fontSize: T.meta, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: C.textFaint, marginBottom: 8 }}>
            Per project
          </p>
          <div style={{ display: 'grid', gap: 7 }}>
            {data.perProject.map((p) => (
              <div key={p.workspaceId} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: T.bodySm, color: C.textSub, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.title}
                </span>
                <span style={{ fontSize: T.meta, color: C.textFaint, flexShrink: 0 }}>
                  {p.taskCount} task{p.taskCount === 1 ? '' : 's'}
                  {p.metrics.estimation.bias.value !== null && ` · ${bias(p.metrics.estimation.bias)}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
