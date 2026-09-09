'use client'

import { COPY, type Audience } from './audience'
import { C, F } from './tokens'

/**
 * The four ways in.
 *
 * The page used to read as one product — get evidence — which is a reason to
 * sign up and not a reason to come back. This is the section that says there
 * is more than one thing to do here, and it sits between the hero and the
 * loop because it answers the question the hero raises: fine, but what do I
 * actually do on Monday?
 *
 * The fourth card is not built and says so. That is not a hedge, it is the
 * argument: a list of four things where the reader can only verify three
 * teaches them to discount all four. Marking one honestly is what makes the
 * other three land — and in this case the unbuilt one needs students on the
 * platform before it can exist, which is a reason to be early rather than
 * something to hide.
 *
 * Reuses .wm-step from the loop deliberately. Two card treatments on one page
 * for the same kind of content is a design that drifted, not a decision.
 */
export function TheModes({ audience }: { audience: Audience }) {
  const copy = COPY[audience]

  return (
    <section className="wm-section" style={{ paddingTop: 0 }}>
      <div className="wm-section-inner">
        <div style={{ maxWidth: 720, marginBottom: 44 }}>
          <span className="wm-eyebrow-2">{copy.modesEyebrow}</span>
          <h2 className="wm-h2">{copy.modesHeadline}</h2>
          <p className="wm-lede">{copy.modesLede}</p>
        </div>

        <div
          className="mob-1col"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 56, rowGap: 30 }}
        >
          {copy.modes.map((mode) => (
            <div key={mode.title} className={`wm-step${mode.now ? '' : ' wm-step-soon'}`}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 9 }}>
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
                      flexShrink: 0, fontFamily: F.sans, fontSize: 11.5, fontWeight: 600,
                      color: C.textMuted, background: 'rgba(10,10,10,0.05)',
                      borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap',
                    }}
                  >
                    Being built
                  </span>
                )}
              </div>
              <p style={{ fontFamily: F.sans, fontSize: 14.5, color: C.textMuted, lineHeight: 1.62, textWrap: 'pretty' }}>
                {mode.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
