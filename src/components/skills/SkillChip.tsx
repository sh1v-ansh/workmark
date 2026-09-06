'use client'

import { LEVEL_NAMES, SELF_EVIDENCED_CAP } from '@/lib/skills/level-names'
import { LEVELS, C, R } from '@/lib/theme/dark-tokens'

/**
 * One skill, at one level.
 *
 * Gold is the whole point of this component and the whole risk in it. It
 * marks a skill the scan could actually prove out, and it works because it
 * is scarce — on a typical record six of thirty-seven carry it. Paint the
 * list gold and it stops meaning anything, so the level decides the
 * treatment and the caller never gets to.
 *
 * Which is also why PlainChip exists below. The projects list shows the
 * skills found in each repository, and an advanced skill found in five
 * repositories would be five gold chips for one achievement — the same
 * medal handed out five times. A project does not have a level; the skill
 * does. So the projects list gets names, and the level lives where the
 * skill lives.
 *
 * Nothing gold is a button. A chip may be clickable to open its evidence,
 * which is a disclosure rather than an action, and it stays a chip while it
 * does it — no border change, no hover lift.
 */
export function levelTone(level: number) {
  if (level >= SELF_EVIDENCED_CAP) return LEVELS.advanced
  if (level === 2) return LEVELS.intermediate
  return LEVELS.beginner
}

function base(size: 'sm' | 'md'): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: size === 'sm' ? 5 : 6,
    fontSize: size === 'sm' ? 12.5 : 13,
    fontWeight: 600,
    lineHeight: 1.25,
    padding: size === 'sm' ? '5px 9.5px' : '6px 11px',
    borderRadius: R.sm,
    maxWidth: '100%',
    textAlign: 'left',
  }
}

export default function SkillChip({
  name,
  level,
  onClick,
  size = 'md',
  showLevel = true,
}: {
  name: string
  level: number
  onClick?: () => void
  size?: 'sm' | 'md'
  /** Off inside a list already grouped by level — a row of chips reading
   *  "Docker Intermediate, Redis Intermediate, GraphQL Intermediate" under a
   *  heading saying INTERMEDIATE spends a third of the width saying nothing.
   *  The colour still carries the level either way. */
  showLevel?: boolean
}) {
  const tone = levelTone(level)
  const label = LEVEL_NAMES[level] ?? `Level ${level}`

  const style: React.CSSProperties = {
    ...base(size),
    background: tone.fill,
    border: `1px solid ${tone.border}`,
    color: tone.text,
    boxShadow: tone.shadow,
  }

  const inner = (
    <>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      {showLevel && (
        <span style={{ fontSize: size === 'sm' ? 10.5 : 11, fontWeight: 600, color: tone.sub, whiteSpace: 'nowrap' }}>
          {label}
        </span>
      )}
    </>
  )

  if (!onClick) return <span style={style}>{inner}</span>

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...style, cursor: 'pointer', font: 'inherit', fontWeight: 600 }}
      aria-label={`${name}, ${label} — see where this came from`}
    >
      {inner}
    </button>
  )
}

/** The level on its own, in its own colour. For headings where the skill's
 *  name is already the heading. */
export function LevelBadge({ level, size = 'sm' }: { level: number; size?: 'sm' | 'md' }) {
  const tone = levelTone(level)
  return (
    <span
      style={{
        ...base(size),
        background: tone.fill,
        border: `1px solid ${tone.border}`,
        color: tone.text,
        boxShadow: tone.shadow,
      }}
    >
      {LEVEL_NAMES[level] ?? `Level ${level}`}
    </span>
  )
}

/** A skill name with no level and no colour. For lists where the subject is
 *  something other than how good the person is at it. */
export function PlainChip({
  name,
  onClick,
  size = 'sm',
}: {
  name: string
  onClick?: () => void
  size?: 'sm' | 'md'
}) {
  const style: React.CSSProperties = {
    ...base(size),
    background: C.surfaceAlt,
    border: `1px solid ${C.border}`,
    color: C.textSub,
    fontWeight: 500,
  }

  if (!onClick) return <span style={style}>{name}</span>

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...style, cursor: 'pointer', font: 'inherit', fontWeight: 500 }}
      aria-label={`${name} — see where this came from`}
    >
      {name}
    </button>
  )
}
