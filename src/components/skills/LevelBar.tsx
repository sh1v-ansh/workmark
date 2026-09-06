'use client'

import { LEVELS, C, R } from '@/lib/theme/dark-tokens'
import { SELF_EVIDENCED_CAP } from '@/lib/skills/level-names'

export interface LevelCounts {
  advanced: number
  intermediate: number
  beginner: number
  total: number
}

export function countLevels(skills: { bestLevel: number }[]): LevelCounts {
  let advanced = 0, intermediate = 0, beginner = 0
  for (const s of skills) {
    if (s.bestLevel >= SELF_EVIDENCED_CAP) advanced++
    else if (s.bestLevel === 2) intermediate++
    else beginner++
  }
  return { advanced, intermediate, beginner, total: skills.length }
}

/**
 * The shape of a record in one line.
 *
 * This is what replaced printing every skill. A student with thirty-seven of
 * them was shown thirty-seven chips, so the box grew without limit and the
 * answer to "how good is this record" was buried in the middle of it. Three
 * numbers and a bar answer that in about a second, and the chips underneath
 * become a sample rather than an inventory.
 *
 * Widths are proportions of the total, so the bar says the same thing at
 * four skills as at four hundred. Segments below a couple of percent are
 * floored so a single advanced skill is still a visible sliver rather than
 * a rounding error — being hard to see is fine, disappearing is not.
 */
export default function LevelBar({
  counts,
  height = 7,
  showLegend = true,
}: {
  counts: LevelCounts
  height?: number
  showLegend?: boolean
}) {
  if (counts.total === 0) return null

  const pct = (n: number) => (n === 0 ? 0 : Math.max(3, (n / counts.total) * 100))
  const segments = [
    { key: 'advanced', n: counts.advanced, fill: LEVELS.advanced.bar, label: 'Advanced' },
    { key: 'intermediate', n: counts.intermediate, fill: LEVELS.intermediate.bar, label: 'Intermediate' },
    { key: 'beginner', n: counts.beginner, fill: LEVELS.beginner.bar, label: 'Beginner' },
  ].filter((s) => s.n > 0)

  const total = segments.reduce((sum, s) => sum + pct(s.n), 0)

  return (
    <div>
      <div
        style={{ display: 'flex', height, borderRadius: R.pill, overflow: 'hidden', background: C.borderFaint }}
        role="img"
        aria-label={segments.map((s) => `${s.n} ${s.label.toLowerCase()}`).join(', ')}
      >
        {segments.map((s) => (
          <div key={s.key} style={{ width: `${(pct(s.n) / total) * 100}%`, background: s.fill }} />
        ))}
      </div>
      {showLegend && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 16px', marginTop: 9 }} aria-hidden="true">
          {segments.map((s) => (
            <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: C.textFaint }}>
              <span style={{ width: 8, height: 8, borderRadius: R.pill, background: s.fill, flexShrink: 0 }} />
              {s.n} {s.label.toLowerCase()}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
