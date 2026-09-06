'use client'

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

const STEPS = [
  {
    n: '01',
    title: 'Connect the code you have already written',
    body: 'Pick the repositories. Workmark reads what they depend on, how they are built and which commits are yours, and turns that into skills at a level, each with the project behind it.',
    now: true,
  },
  {
    n: '02',
    title: 'Find work that uses them',
    body: 'Projects posted by faculty and other students, with your record already attached. You see what each one needs and where you fall short before you apply.',
    now: true,
  },
  {
    n: '03',
    title: 'Get something to build when nothing fits',
    body: 'On a young marketplace there will be days with nothing for you. Workmark compares what open projects keep asking for against what you can prove, and writes you a project that closes the gap.',
    now: true,
  },
  {
    n: '04',
    title: 'Work in the open, and let that count too',
    body: 'A shared workspace for the projects you take on — plan, tasks, deadlines, blockers — where finishing something on time, or seeing early that you will not and saying so, becomes part of the record alongside the code.',
    now: false,
  },
]

export function TheLoop() {
  return (
    <section className="wm-section">
      <div className="wm-section-inner">
        <div style={{ maxWidth: 700, marginBottom: 48 }}>
          <span className="wm-eyebrow-2">How it works</span>
          <h2 className="wm-h2">Do real work. Build evidence of it. Let the evidence open the door.</h2>
          <p className="wm-lede">
            That is the whole idea, and the order matters — the record is a by-product of
            doing something, not a form you fill in.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 20 }} className="mob-1col">
          {STEPS.map((step) => (
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
