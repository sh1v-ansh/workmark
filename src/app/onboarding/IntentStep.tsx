'use client'

import Button from '@/components/ui/Button'
import { C, R } from '@/lib/theme/dark-tokens'
import { INTENTS, INTENT_ORDER, type Intent } from '@/lib/profile/intents'

/**
 * "What do you want to do here?"
 *
 * ── Why this screen exists ────────────────────────────────────────────────
 * Almost everybody arrives believing Workmark is one thing — it reads your
 * code and gives you a record — because that is the half we lead with
 * everywhere. A student who never learns about the other three never posts a
 * project, never joins one, and never starts a guided build. The features
 * are there and nobody meets them.
 *
 * A tour is the obvious answer and is the thing everybody builds and nobody
 * reads. A choice is different: picking something is how you find out it was
 * on offer, it costs one screen, and unlike a tour it leaves behind an
 * answer worth acting on — this orders their dashboard afterwards.
 *
 * ── Why nothing is required ───────────────────────────────────────────────
 * Somebody who does not know yet is giving an honest answer, and forcing a
 * pick would turn this into a question people learn to click past. Skipping
 * is a real option and says what happens if you take it.
 */
export default function IntentStep({
  chosen,
  onChange,
  onContinue,
  busy,
}: {
  chosen: Intent[]
  onChange: (next: Intent[]) => void
  onContinue: () => void
  busy: boolean
}) {
  const toggle = (intent: Intent) => {
    onChange(chosen.includes(intent) ? chosen.filter((i) => i !== intent) : [...chosen, intent])
  }

  return (
    <div>
      <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6, marginBottom: 20 }}>
        Pick as many as you like. You can change this later.
      </p>

      <div style={{ display: 'grid', gap: 9, marginBottom: 22 }}>
        {INTENT_ORDER.map((intent) => {
          const on = chosen.includes(intent)
          return (
            <button
              key={intent}
              type="button"
              onClick={() => toggle(intent)}
              aria-pressed={on}
              style={{
                display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                fontFamily: 'inherit', padding: '14px 16px', borderRadius: R.md,
                background: on ? C.accentHover : C.surface,
                border: `1px solid ${on ? C.accentBorder : C.border}`,
                transition: 'background 0.12s, border-color 0.12s',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                {/* A box rather than a tick that appears from nowhere: the
                    empty state has to look like something you can press. */}
                <span
                  aria-hidden="true"
                  style={{
                    flexShrink: 0, marginTop: 1, width: 18, height: 18, borderRadius: 5,
                    border: `1.5px solid ${on ? C.accent : C.border}`,
                    background: on ? C.accent : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {on && (
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6.2l2.4 2.4 4.6-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: C.text, marginBottom: 3 }}>
                    {INTENTS[intent].label}
                  </span>
                  <span style={{ display: 'block', fontSize: 13, color: C.textFaint, lineHeight: 1.55 }}>
                    {INTENTS[intent].detail}
                  </span>
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <Button onClick={onContinue} variant="accent" fullWidth busyLabel={busy ? 'Saving…' : null}>
        {chosen.length === 0 ? 'Skip for now' : 'Continue'}
      </Button>
      {chosen.length === 0 && (
        <p style={{ fontSize: 13, color: C.textGhost, lineHeight: 1.55, marginTop: 10, textAlign: 'center' }}>
          Not sure yet is a fine answer — you will see all four on your dashboard either way.
        </p>
      )}
    </div>
  )
}
