'use client'

import Link from 'next/link'
import { type Audience } from './audience'
import { C, F } from './tokens'

/**
 * The externship, given the room it deserves.
 *
 * It was one clause inside step two — "Workmark writes you a project that
 * closes your biggest gap" — which is a footnote for the feature that
 * answers the hardest objection a student has. Everything else on this page
 * assumes they already did something worth reading. This is the part that
 * works when they have not, and on a marketplace this young it is the part
 * that works when nobody has posted anything either.
 *
 * The whole loop is live today: Workmark picks the skill, writes the brief,
 * takes a repo, and reads what comes back exactly like any other project.
 * The workspace deepens it and is not built, so it sits at the end, dimmed,
 * and says so.
 */

const FRAMING: Record<Audience, {
  eyebrow: string
  headline: string
  lede: string
  steps: { title: string; body: string; soon?: boolean }[]
  cta: { label: string; href: string }
}> = {
  students: {
    eyebrow: 'Simulated work experience',
    headline: 'The externship you don’t have to apply for',
    lede:
      'Everyone wants experience and nobody will give you any. So Workmark hands you the work instead. A real project, scoped to the exact skill you are missing, that ends up on your record like anything else you have built.',
    steps: [
      {
        title: 'Workmark picks the project',
        body: 'It compares what open projects keep asking for against what you can prove, then writes a brief for the biggest gap.',
      },
      {
        title: 'You build it in your own repo',
        body: 'Link a repository and Workmark starts reading it. Your account, your code, yours to show anyone.',
      },
      {
        title: 'It counts like real work',
        body: 'The scan reads it the same way it reads everything else. Same levels, same evidence, no asterisk saying it was practice.',
      },
      {
        title: 'Soon: the workspace around it',
        body: 'Plan it, break it into tasks, set your own deadlines and flag what blocks you. Hitting them becomes evidence too.',
        soon: true,
      },
    ],
    cta: { label: 'Get my first project', href: '/login' },
  },
  businesses: {
    eyebrow: 'Where the work comes from',
    headline: 'Candidates who have shipped something on purpose',
    lede:
      'A student with no internship is not a student with no evidence. Workmark writes them scoped projects aimed at real gaps, and reads the result exactly as it reads anything else. What reaches you is finished work against a brief.',
    steps: [
      {
        title: 'The brief is not theirs to pick',
        body: 'Workmark chooses the skill from what open projects are actually asking for, so the work targets real demand rather than what a student already finds easy.',
      },
      {
        title: 'Scoped, so it is comparable',
        body: 'Every brief carries a difficulty and a target skill. Two candidates who finished comparable projects really did comparable work.',
      },
      {
        title: 'Read like everything else',
        body: 'No separate scoring path and no bonus for having tried. It goes through the same scan and earns the same levels.',
      },
      {
        title: 'Soon: how they ran it',
        body: 'Estimates against actuals, blockers raised early, commitments met. The reference call, observed instead of asked about.',
        soon: true,
      },
    ],
    cta: { label: 'See how the record works', href: '/how-it-works' },
  },
}

export function TheExternship({ audience }: { audience: Audience }) {
  const copy = FRAMING[audience]

  return (
    <section className="wm-section" style={{ paddingTop: 0 }}>
      <div className="wm-section-inner">
        <div className="wm-externship">
          <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.1fr)', gap: 52, alignItems: 'center' }} className="mob-1col">
            <div>
              <span className="wm-eyebrow-2">{copy.eyebrow}</span>
              <h2 className="wm-h2">{copy.headline}</h2>
              <p className="wm-lede" style={{ marginBottom: 26 }}>{copy.lede}</p>
              <Link href={copy.cta.href} className="wm-cta-primary">{copy.cta.label}</Link>
            </div>

            {/* The card itself, in the same clothes it wears in the product:
                violet ground, Workmark AI signature, "Start this" rather than
                "Apply". A picture of the feature beats a paragraph about it. */}
            <div>
              <div className="wm-ai-demo">
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 11, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6.5, fontFamily: F.sans, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.accent }}>
                      <svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M9 2.5l1.5 4 4 1.5-4 1.5L9 13.5 7.5 9.5l-4-1.5 4-1.5L9 2.5z" />
                      </svg>
                      Workmark AI
                    </span>
                    <span style={{ fontFamily: F.sans, fontSize: 11.5, fontWeight: 600, color: C.accent, background: 'rgba(62,31,255,0.10)', border: '1px solid rgba(62,31,255,0.18)', borderRadius: 999, padding: '3px 9px' }}>
                      Fills a gap
                    </span>
                  </div>
                  <h3 style={{ fontFamily: F.serif, fontSize: 17, fontWeight: 600, letterSpacing: '-0.016em', color: C.text, lineHeight: 1.3, marginBottom: 8 }}>
                    Containerise the sensor mesh dashboard
                  </h3>
                  <p style={{ fontFamily: F.sans, fontSize: 13.5, color: C.textMuted, lineHeight: 1.55, marginBottom: 10 }}>
                    Take a project you already run locally and get it to a single docker compose up,
                    with a multi-stage build and no secrets in the image.
                  </p>
                  <p style={{ fontFamily: F.sans, fontSize: 12.5, color: C.textFaint, lineHeight: 1.5, marginBottom: 14 }}>
                    Open projects are asking for Docker and your record does not have it yet.
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: F.sans, fontSize: 12.5, color: C.textFaint }}>Builds Docker · A weekend</span>
                    <span style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 600, color: C.accent }}>Start this →</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 11, marginTop: 14 }}>
                {copy.steps.map((step) => (
                  <div key={step.title} className={`wm-ext-step${step.soon ? ' wm-ext-step-soon' : ''}`}>
                    <p style={{ fontFamily: F.sans, fontSize: 13.5, fontWeight: 600, color: step.soon ? C.textMuted : C.text, marginBottom: 4 }}>
                      {step.title}
                    </p>
                    <p style={{ fontFamily: F.sans, fontSize: 12.5, color: C.textFaint, lineHeight: 1.55 }}>
                      {step.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
