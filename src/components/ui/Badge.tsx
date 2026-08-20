import { state, R, C } from '@/lib/theme/dark-tokens'

export type BadgeTone = 'neutral' | 'positive' | 'caution' | 'info' | 'accent'

const TONES: Record<BadgeTone, { color: string; bg: string }> = {
  neutral:  { color: state.neutral,  bg: state.neutralBg },
  positive: { color: state.positive, bg: state.positiveBg },
  caution:  { color: state.caution,  bg: state.cautionBg },
  info:     { color: state.info,     bg: state.infoBg },
  accent:   { color: C.accentInk,    bg: '#EDE9FF' },
}

/**
 * A status label. Lowercase-with-a-capital, never ALL CAPS shouting — these
 * sit next to a project title and shouldn't outrank it.
 *
 * Tone is semantic: `positive` means something good happened to the user,
 * not "this is green". Anything that is merely a fact (Unread, Draft) is
 * `neutral` — colouring a neutral fact makes every colour on the page mean
 * less.
 */
export default function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: React.ReactNode }) {
  const t = TONES[tone]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 11.5,
        fontWeight: 600,
        color: t.color,
        background: t.bg,
        borderRadius: R.sm,
        padding: '4px 9px',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}
