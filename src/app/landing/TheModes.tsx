'use client'

import { COPY, type Audience } from './audience'
import { C, F } from './tokens'

/**
 * The four ways in.
 *
 * The page used to read as one product — get evidence — which is a reason to
 * sign up and not a reason to come back. This is the section that says there
 * is more than one thing to do here, and it sits between the hero and the
 * guided project because it answers the question the hero raises: fine, but
 * what do I actually do on Monday?
 *
 * The fourth item is not built and says so. That is not a hedge, it is the
 * argument: a list of four things where the reader can only verify three
 * teaches them to discount all four. Marking one honestly is what makes the
 * other three land, and in this case the unbuilt one needs students on the
 * platform before it can exist, which is a reason to be early rather than
 * something to hide.
 *
 * ── Why this is a list and not a grid ──────────────────────────────────
 * It was a two-column grid where each cell carried a hairline above it.
 * Four cells means the two rules on a row both stop at the gutter, so what
 * the eye reads is one broken line with a hole punched in the middle — a
 * rule that divides nothing, floating above text it does not enclose.
 *
 * Rows fix it by making the rule mean something: it spans the full width, so
 * it separates one item from the next the way a divider is supposed to. The
 * label column also gives every item the same left edge, and that alignment
 * does the containing that the borders were failing to do.
 *
 * It is deliberately a different structure from the loop below, which is a
 * numbered grid with no rules at all. Two sections built the same way is
 * what made this page feel generated in the first place.
 */
export function TheModes({ audience }: { audience: Audience }) {
  const copy = COPY[audience]

  return (
    <section className="wm-section">
      <div className="wm-section-inner">
        <div style={{ maxWidth: 720, marginBottom: 40 }}>
          <span className="wm-eyebrow-2">{copy.modesEyebrow}</span>
          <h2 className="wm-h2">{copy.modesHeadline}</h2>
          <p className="wm-lede">{copy.modesLede}</p>
        </div>

        <div className="wm-rows">
          {copy.modes.map((mode) => (
            <div key={mode.title} className={`wm-row${mode.now ? '' : ' wm-row-soon'}`}>
              <div className="wm-row-label">
                <h3
                  style={{
                    fontFamily: F.serif, fontSize: 18.5, fontWeight: 600, letterSpacing: '-0.018em',
                    color: mode.now ? C.text : C.textSub, lineHeight: 1.3, textWrap: 'pretty',
                  }}
                >
                  {mode.title}
                </h3>
                {!mode.now && (
                  <span
                    style={{
                      alignSelf: 'flex-start', flexShrink: 0,
                      fontFamily: F.sans, fontSize: 11.5, fontWeight: 600,
                      color: C.textMuted, background: 'rgba(10,10,10,0.05)',
                      borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap',
                    }}
                  >
                    Being built
                  </span>
                )}
              </div>
              <p style={{ fontFamily: F.sans, fontSize: 15, color: C.textMuted, lineHeight: 1.62, textWrap: 'pretty' }}>
                {mode.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
