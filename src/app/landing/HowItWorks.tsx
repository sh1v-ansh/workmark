'use client'

import Link from 'next/link'
import { AudienceToggle } from './AudienceToggle'
import { COPY, type Audience } from './audience'
import { Aurora } from './Aurora'
import { C, F } from './tokens'

/**
 * /how-it-works, rebuilt.
 *
 * The old version was three numbered columns in hairline mono type
 * describing a flow that no longer exists — organisations post, students
 * apply, the employer confirms with one button and the record locks. That is
 * the attestation story, and the product does not work that way yet.
 *
 * It carries the same audience switch as the home page, because "how does it
 * work" has two answers and the honest one depends on which side of the
 * marketplace is asking.
 */

const DETAIL: Record<Audience, { title: string; body: string }[]> = {
  students: [
    {
      title: 'We never read your source code',
      body: 'Manifests, build files, which files import what, commit dates and authorship, whether tests exist. The code itself is never stored or looked at.',
    },
    {
      title: 'Depth beats volume',
      body: 'How much of it you wrote, how long you stuck with it, whether you came back and fixed things. One weekend and one semester are not the same claim.',
    },
    {
      title: 'Private stays private',
      body: 'Private repo names show up in your own scan history and nowhere else. Nothing is public until you claim a handle. Disconnect and we stop reading immediately.',
    },
  ],
  businesses: [
    {
      title: 'There is no box to exaggerate in',
      body: 'Everything comes from repositories the candidate owns. They never rate themselves, so there is nothing to inflate and nothing to take on trust.',
    },
    {
      title: 'Levels move as the platform grows',
      body: 'A level is set against every other record rather than a rubric written once. As more work arrives, the bar recalibrates and stays meaningful.',
    },
    {
      title: 'What we will not tell you',
      body: 'A scan shows what someone built, not what they are like to work with. Anything above Advanced needs a person who worked with them to say so, and we cannot produce that yet.',
    },
  ],
}

export function HowItWorks({
  audience,
  onAudienceChange,
}: {
  audience: Audience
  onAudienceChange: (next: Audience) => void
}) {
  const copy = COPY[audience]

  return (
    <>
      <section style={{ position: 'relative', overflow: 'hidden', padding: '138px 24px 80px', textAlign: 'center' }}>
        <Aurora height={620} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 760, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 26 }}>
            <AudienceToggle value={audience} onChange={onAudienceChange} />
          </div>
          <h1 style={{ fontFamily: F.serif, fontSize: 50, fontWeight: 600, letterSpacing: '-0.026em', lineHeight: 1.1, color: C.text, margin: '0 0 18px', textWrap: 'balance' }}>
            {copy.loopHeadline}
          </h1>
          <p style={{ fontFamily: F.sans, fontSize: 18, lineHeight: 1.62, color: C.textMuted, maxWidth: 620, margin: '0 auto', textWrap: 'pretty' }}>
            {copy.loopLede}
          </p>
        </div>
      </section>

      <section className="wm-section" style={{ paddingTop: 0 }}>
        <div className="wm-section-inner">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 20, marginBottom: 26 }} className="mob-1col">
            {copy.steps.map((step) => (
              <div key={step.n} className={`wm-step${step.now ? '' : ' wm-step-soon'}`}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                  <span style={{ fontFamily: F.sans, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.06em', color: step.now ? C.accent : C.textFaint }}>
                    {step.n}
                  </span>
                  {!step.now && (
                    <span style={{ fontFamily: F.sans, fontSize: 11.5, fontWeight: 600, color: C.textMuted, background: 'rgba(10,10,10,0.05)', borderRadius: 999, padding: '3px 10px' }}>
                      Being built
                    </span>
                  )}
                </div>
                <h2 style={{ fontFamily: F.serif, fontSize: 18.5, fontWeight: 600, letterSpacing: '-0.018em', color: C.text, lineHeight: 1.3, marginBottom: 9, textWrap: 'pretty' }}>
                  {step.title}
                </h2>
                <p style={{ fontFamily: F.sans, fontSize: 14.5, color: C.textMuted, lineHeight: 1.62, textWrap: 'pretty' }}>
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The part people actually want when they click "how it works": not
          the pitch again, but what is being read and what is being claimed. */}
      <section className="wm-section" style={{ background: '#FBFBFD', borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, paddingTop: 72 }}>
        <div className="wm-section-inner">
          <span className="wm-eyebrow-2">The detail</span>
          <h2 className="wm-h2" style={{ marginBottom: 32 }}>
            {audience === 'students' ? 'The bits people ask about' : 'Where the number comes from'}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 20 }} className="mob-1col">
            {DETAIL[audience].map((item) => (
              <div key={item.title} className="wm-step">
                <h3 style={{ fontFamily: F.serif, fontSize: 17, fontWeight: 600, letterSpacing: '-0.016em', color: C.text, marginBottom: 9, textWrap: 'pretty' }}>
                  {item.title}
                </h3>
                <p style={{ fontFamily: F.sans, fontSize: 14, color: C.textMuted, lineHeight: 1.62, textWrap: 'pretty' }}>
                  {item.body}
                </p>
              </div>
            ))}
          </div>

          <p style={{ fontFamily: F.sans, fontSize: 14.5, color: C.textMuted, marginTop: 28 }}>
            {audience === 'students' ? (
              <>Still deciding? <Link href="/levels" style={{ color: C.accent, fontWeight: 600, textDecoration: 'none' }}>Read what each level means →</Link></>
            ) : (
              <>Want the full scale? <Link href="/levels" style={{ color: C.accent, fontWeight: 600, textDecoration: 'none' }}>See how levels are defined →</Link></>
            )}
          </p>
        </div>
      </section>
    </>
  )
}
