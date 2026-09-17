import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import { C, F, T } from '@/lib/theme/dark-tokens'
import type { CloseSummary } from '@/lib/workspace/queries'

/**
 * What a finished project produced.
 *
 * The moment the whole feature exists to be able to show, so it opens the
 * board page rather than sitting behind a tab — a project that ended on a
 * blank kanban would waste the thing the student is proudest of.
 */
export default function CloseSummaryCard({
  summary,
  evidenceMintedAt,
}: {
  summary: CloseSummary
  evidenceMintedAt: string | null
}) {
  const figures = [
    { n: summary.yoursFinished, label: summary.yoursFinished === 1 ? 'task you finished' : 'tasks you finished' },
    { n: summary.finishedTasks, label: 'verified across the team' },
    {
      n: summary.skillsAdded.length,
      label: summary.skillsAdded.length === 1 ? 'skill on your record' : 'skills on your record',
    },
  ]

  return (
    <Card focal style={{ marginBottom: 26 }}>
      <p style={{ fontSize: T.h3, fontWeight: 600, color: C.text, marginBottom: 5 }}>
        This project is finished
      </p>
      <p style={{ fontSize: T.bodySm, color: C.textMuted, lineHeight: 1.65, marginBottom: 18, maxWidth: '60ch' }}>
        Everything below came from work that was checked — not from anything anybody
        typed about themselves.
      </p>

      <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', marginBottom: 18 }}>
        {figures.map((f) => (
          <div key={f.label}>
            <p style={{ fontFamily: F.display, fontSize: 26, fontWeight: 600, color: C.text, lineHeight: 1.1 }}>
              {f.n}
            </p>
            <p style={{ fontSize: T.meta, color: C.textMuted, marginTop: 3 }}>{f.label}</p>
          </div>
        ))}
      </div>

      {/* Null evidence_minted_at on a closed project means the scan has not
          finished. Saying so beats showing a zero that reads as a verdict on
          their work. */}
      {evidenceMintedAt === null ? (
        <p style={{ fontSize: T.bodySm, color: C.textMuted, lineHeight: 1.6, maxWidth: '60ch' }}>
          Your record is still updating — reading the repository takes a few minutes and
          finishes overnight at the latest. Nothing is lost; check back tomorrow.
        </p>
      ) : summary.skillsAdded.length > 0 ? (
        <div>
          <p style={{ fontSize: T.bodySm, color: C.textMuted, lineHeight: 1.6, marginBottom: 12, maxWidth: '60ch' }}>
            These are now part of your record, with this project as the evidence behind them.
          </p>
          <Button href="/me">See your record</Button>
        </div>
      ) : (
        <p style={{ fontSize: T.bodySm, color: C.textMuted, lineHeight: 1.6, maxWidth: '60ch' }}>
          No skills were added from this one. That usually means the repository had no
          commits under your GitHub account, or none of your tasks were verified.
        </p>
      )}
    </Card>
  )
}
