'use client'

import { C, F } from './tokens'

const flow = [
  { n: '01', title: 'Do real work', body: 'A student completes a project, internship, or research task — for a company, a nonprofit, or another student team.' },
  { n: '02', title: 'Poster attests', body: 'The organization or student poster confirms the engagement happened and the skills were used. One click. No files, no code stored.' },
  { n: '03', title: 'Record locks', body: 'A permanent, tamper-proof Workmark record is created: who, what stack, how long, verified by whom.' },
  { n: '04', title: 'The database grows', body: 'Every locked record joins the largest structured dataset of verified work — the signal hiring has always lacked.' },
]

export function VerifiedRecords() {
  return (
    <section style={{ borderTop: `1px solid ${C.border}`, padding: '96px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div className="reveal-item" style={{ maxWidth: 760, marginBottom: 56 }}>
          <div className="wm-eyebrow" style={{ marginBottom: 22 }}>The solution</div>
          <h2 className="mob-text-h1" style={{ fontFamily: F.serif, fontSize: 46, fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.03em', color: C.text, margin: '0 0 20px' }}>
            A verified record for every piece of work.
          </h2>
          <p style={{ fontSize: 18, lineHeight: 1.7, color: C.textMuted }}>
            Instead of asking employers to trust a claim, Workmark captures proof at the moment
            work is done — and turns it into a portable credential the student owns forever.
          </p>
        </div>

        {/* Flow diagram */}
        <div className="reveal-item mob-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, position: 'relative' }}>
          {flow.map((step, i) => (
            <div key={step.n} style={{ position: 'relative', padding: '0 20px' }}>
              {/* Connector line */}
              {i < flow.length - 1 && (
                <div aria-hidden="true" className="mob-hide" style={{ position: 'absolute', top: 22, right: -1, width: 40, height: 1, background: `linear-gradient(90deg, ${C.accentBorder}, transparent)` }} />
              )}
              <div style={{ width: 44, height: 44, borderRadius: 12, background: C.accentHover, border: `1px solid ${C.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                <span style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 700, color: C.accent }}>{step.n}</span>
              </div>
              <h3 style={{ fontFamily: F.serif, fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 10 }}>{step.title}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: C.textMuted, marginBottom: 28 }}>{step.body}</p>
            </div>
          ))}
        </div>

        {/* Payoff bar */}
        <div className="reveal-item" style={{ marginTop: 24, background: C.bgDeep, borderRadius: 16, padding: '36px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <p style={{ fontFamily: F.serif, fontSize: 26, fontWeight: 700, lineHeight: 1.3, color: '#fff', margin: 0, maxWidth: 640 }}>
            The result: a hiring signal that&apos;s earned, not claimed — and impossible to fake.
          </p>
          <div style={{ fontFamily: F.sans, fontSize: 13, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.04em' }}>
            IDENTITY · DURATION · POSTER CONFIRMATION
          </div>
        </div>
      </div>
    </section>
  )
}
