'use client'

import Link from 'next/link'
import { LEVEL_NAMES, LEVEL_DESCRIPTIONS, isReachable } from '@/lib/skills/level-names'
import { C, R } from '@/lib/theme/dark-tokens'

/**
 * A level name that can explain itself.
 *
 * "Familiar" and "Practiced" are the two words the whole record hangs on and
 * neither says what it means. That was previously answered by a paragraph
 * standing permanently above the skills list, which every reader paid for
 * and almost none needed twice.
 *
 * A hover card puts the answer where the question occurs. CSS-driven rather
 * than stateful so it costs nothing to render one of these per skill, and
 * opened by :focus-within as well as :hover so it is reachable by keyboard —
 * a tooltip containing a link that only appears on mouseover is not.
 */
export default function LevelTag({
  level,
  style,
}: {
  level: number
  style?: React.CSSProperties
}) {
  const name = LEVEL_NAMES[level] ?? `Level ${level}`
  const description = LEVEL_DESCRIPTIONS[level]

  if (!description) return <span style={style}>{name}</span>

  return (
    <span className="nb-leveltag" style={style}>
      <span tabIndex={0} className="nb-leveltag-label" role="button" aria-label={`${name} — what this level means`}>
        {name}
      </span>
      <span className="nb-leveltag-card" role="tooltip">
        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: C.text, marginBottom: 4 }}>
          {name}
          {!isReachable(level) && (
            <span style={{ fontWeight: 500, color: C.textFaint }}> · not reachable yet</span>
          )}
        </span>
        <span style={{ display: 'block', fontSize: 12.5, color: C.textMuted, lineHeight: 1.5, marginBottom: 7 }}>
          {description}
        </span>
        <Link
          href="/levels"
          style={{ fontSize: 12.5, color: C.accent, fontWeight: 600, textDecoration: 'none', borderRadius: R.sm }}
        >
          Learn more →
        </Link>
      </span>
    </span>
  )
}
