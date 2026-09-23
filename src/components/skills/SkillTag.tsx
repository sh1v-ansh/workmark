import { R } from '@/lib/theme/dark-tokens'
import { tagColor } from '@/lib/theme/tagColors'

/**
 * A skill named without a level — what a project asks for, or a skill
 * mentioned in passing. SkillChip is for skills somebody has proven, and
 * its colour means a level; using it here would claim one.
 *
 * One component so the four places that drew this by hand stop drifting
 * apart in padding, weight and border.
 */
export default function SkillTag({ name, muted = false }: { name: string; muted?: boolean }) {
  const c = tagColor(name)
  return (
    <span
      style={{
        display: 'inline-block', fontSize: 12.5, fontWeight: 600, padding: '3.5px 9.5px',
        borderRadius: R.pill, background: c.bg, border: `1px solid ${c.border}`, color: c.text,
        opacity: muted ? 0.7 : 1, whiteSpace: 'nowrap',
      }}
    >
      {name}
    </span>
  )
}
