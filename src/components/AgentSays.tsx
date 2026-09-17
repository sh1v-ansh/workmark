'use client'

import { C, R, T } from '@/lib/theme/dark-tokens'

/**
 * One presence, wherever Workmark speaks.
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 * The helper's reply, the week's review, the scope check and the checkpoint
 * were four different boxes of prose in four different files, each a slightly
 * different grey. Nothing said they were the same voice, so none of them read
 * as somebody — they read as text the page had produced.
 *
 * A senior person in the room is a presence, and a presence needs to be
 * recognisable before it is read. One mark, one rule down the side, one
 * heading: after the second time somebody sees it they know who is talking
 * without reading a word.
 *
 * ── Why the answer is split from the action ───────────────────────────────
 * Every one of these is "here is what I think" followed by "so do this". They
 * were running together as one paragraph, which is the thing that makes an AI
 * answer feel like something to skim. The action is short, separated, and
 * always last, because that is the part somebody acts on and the part they
 * come back to.
 */
export default function AgentSays({
  heading,
  body,
  action,
  tone = 'neutral',
  children,
}: {
  /** What this is. Two or three words, never a sentence. */
  heading: string
  /** What it thinks. */
  body: string
  /** The one thing to do about it, when there is one. */
  action?: string | null
  /** Shifts the rule and heading only — never the body, which stays readable. */
  tone?: 'neutral' | 'good' | 'warn'
  children?: React.ReactNode
}) {
  const accent = tone === 'warn' ? '#B45309' : tone === 'good' ? '#0F7B4F' : C.accent

  return (
    <div style={{
      // A rule rather than a box. A bordered card around every AI answer is
      // what made a thread of them look like a form.
      borderLeft: `2px solid ${accent}`,
      paddingLeft: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
        <span
          aria-hidden="true"
          style={{
            width: 18, height: 18, borderRadius: 5, flexShrink: 0,
            background: accent, color: '#fff',
            fontSize: 10, fontWeight: 700, letterSpacing: '-0.02em',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          W
        </span>
        <span style={{
          fontSize: T.meta, fontWeight: 700, letterSpacing: '0.05em',
          textTransform: 'uppercase', color: accent,
        }}>
          {heading}
        </span>
      </div>

      <p style={{ fontSize: T.body, color: C.textSub, lineHeight: 1.65, whiteSpace: 'pre-line' }}>
        {body}
      </p>

      {action && (
        <p style={{
          fontSize: T.bodySm, color: C.text, lineHeight: 1.6, fontWeight: 500,
          marginTop: 10, padding: '9px 11px', borderRadius: R.sm, background: C.surfaceAlt,
        }}>
          {action}
        </p>
      )}

      {children}
    </div>
  )
}
