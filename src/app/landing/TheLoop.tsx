'use client'

import { COPY, type Audience } from './audience'
import { C, F } from './tokens'

/**
 * The loop the whole product is.
 *
 *   do real work → generate evidence → build a record → open doors
 *
 * Written present-tense about what exists and honest about what does not.
 * The old version of this section described the finished shape of the
 * product — a poster confirms the engagement, the record locks — as though
 * it already worked that way. It does not yet, and a page whose subject is
 * verifiable claims cannot make an unverifiable one about itself.
 *
 * Step four is the exception and it is labelled. It is where the execution
 * workspace lands, and saying so is better than either pretending it exists
 * or leaving the loop looking like it stops at three.
 */

export function TheLoop({ audience }: { audience: Audience }) {
  const copy = COPY[audience]
  return (
    <section className="wm-section">
      <div className="wm-section-inner">
        <div style={{ maxWidth: 700, marginBottom: 48 }}>
          <span className="wm-eyebrow-2">{copy.loopEyebrow}</span>
          <h2 className="wm-h2">{copy.loopHeadline}</h2>
          <p className="wm-lede">{copy.loopLede}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 56, rowGap: 30 }} className="mob-1col">
          {copy.steps.map((step) => (
            <div key={step.n} className={`wm-step${step.now ? '' : ' wm-step-soon'}`}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                <span style={{ fontFamily: F.sans, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.06em', color: step.now ? C.accent : C.textFaint }}>
                  {step.n}
                </span>
                {!step.now && (
                  <span style={{
                    fontFamily: F.sans, fontSize: 11.5, fontWeight: 600, color: C.textMuted,
                    background: 'rgba(10,10,10,0.05)', borderRadius: 999, padding: '3px 10px',
                  }}>
                    Being built
                  </span>
                )}
              </div>
              <h3 style={{ fontFamily: F.serif, fontSize: 18.5, fontWeight: 600, letterSpacing: '-0.018em', color: C.text, lineHeight: 1.3, marginBottom: 9, textWrap: 'pretty' }}>
                {step.title}
              </h3>
              <p style={{ fontFamily: F.sans, fontSize: 14.5, color: C.textMuted, lineHeight: 1.62, textWrap: 'pretty' }}>
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
