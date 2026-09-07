'use client'

import Link from 'next/link'
import { type Audience } from './audience'
import { C, F } from './tokens'

/**
 * The externship, given the room it deserves.
 *
 * It was one clause inside somebody else's step — "Workmark writes you a
 * project that closes your biggest gap" — which is a footnote for the
 * feature that answers the hardest objection a student has. Everything else
 * on the page assumes they already built something worth reading. This is
 * the part that works when they have not, and on a marketplace this young it
 * is also the part that works when nobody has posted anything.
 *
 * ── Why the section is in two halves ────────────────────────────────────
 * The top half is live: Workmark picks the skill, writes the brief, takes a
 * repo, and reads what comes back exactly like any other project. That loop
 * closes today with nothing missing.
 *
 * The bottom half is the workspace, and it is not built. It gets shown
 * rather than promised — an actual board, actual task titles — because
 * "a structured environment" is a phrase and a Submitted column with a
 * verification check under it is a thing you can picture. Everything in it
 * sits under one unmistakable "Being built" heading and wears the dashed
 * treatment the unbuilt loop step wears, so nobody reads it as shipped.
 *
 * That balance is the whole risk of this section. Vivid enough to want,
 * labelled clearly enough that wanting it is not being misled.
 */

const FRAMING: Record<Audience, {
  eyebrow: string
  headline: string
  lede: string
  steps: { title: string; body: string }[]
  soonEyebrow: string
  soonHeadline: string
  soonLede: string
  soonPoints: { title: string; body: string }[]
  cta: { label: string; href: string }
}> = {
  students: {
    eyebrow: 'Work experience, without the internship',
    headline: 'The externship you don’t have to apply for',
    lede:
      'Workmark hands you a real project aimed at the exact skill you are missing, then reads what you build the same way it reads everything else. No interview, no rejection email, no waiting until next summer.',
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
        body: 'Same scan, same levels, same evidence. There is no asterisk on your record saying it was practice.',
      },
    ],
    soonEyebrow: 'Being built',
    soonHeadline: 'And soon, the job around the project',
    soonLede:
      'An externship is not just a task list. It is having somewhere to work, someone senior breaking the problem down, and something at the end that says you actually finished it.',
    soonPoints: [
      {
        title: 'A senior dev who plans it with you',
        body: 'Workmark reads the brief and proposes the tasks: schema, then endpoints, then auth, then tests. Edit them, reorder them, throw them out. You commit to the plan, not the AI.',
      },
      {
        title: 'A board, not a pile of good intentions',
        body: 'Backlog, Doing, Submitted, Verified. Your own deadlines and estimates on every task, in one place instead of six browser tabs.',
      },
      {
        title: 'Told what to do today',
        body: 'A short daily list built from what is due, what is blocked and what everything else depends on. Two hours on OAuth, one on the tests, thirty minutes reviewing a teammate.',
      },
      {
        title: 'Stuck is a status, not a failure',
        body: 'Flag a blocker and say why. Reporting early and recovering is worth more to an employer than a deadline you quietly missed, and it gets recorded as such.',
      },
      {
        title: 'Done is checked, not claimed',
        body: 'Move a task to Submitted and Workmark checks the commits, the tests and the CI against what the task actually asked for.',
      },
      {
        title: 'Use AI, and get credit for using it well',
        body: 'Claude, Copilot, Cursor, all fine. What gets measured is whether you specified the work clearly, caught the bad output and shipped something that holds up.',
      },
    ],
    cta: { label: 'Get my first project', href: '/login' },
  },

  businesses: {
    eyebrow: 'Where the work comes from',
    headline: 'Candidates who have shipped something on purpose',
    lede:
      'A student with no internship is not a student with no evidence. Workmark writes them scoped projects aimed at real gaps and reads the result exactly as it reads anything else, so what reaches you is finished work against a brief.',
    steps: [
      {
        title: 'The brief is not theirs to pick',
        body: 'The skill comes from what open projects are actually asking for, not from what a candidate already finds easy.',
      },
      {
        title: 'Scoped, so it is comparable',
        body: 'Every brief carries a target skill and a difficulty. Two candidates who finished comparable projects did comparable work.',
      },
      {
        title: 'Read like everything else',
        body: 'No separate scoring path and no bonus for having tried. Same scan, same levels.',
      },
    ],
    soonEyebrow: 'Being built',
    soonHeadline: 'And soon, how they work — not just what they shipped',
    soonLede:
      'The questions you ask on a reference call, answered by what actually happened rather than by someone remembering it kindly.',
    soonPoints: [
      {
        title: 'Estimates against reality',
        body: 'They said four hours and it took seven. Whether somebody knows their own pace, and whether that improves, is visible over dozens of tasks.',
      },
      {
        title: 'Did they finish what they started',
        body: 'Commitments made, commitments met, work abandoned halfway. Counted across every project rather than asked about once.',
      },
      {
        title: 'How they behave when it goes wrong',
        body: 'Someone who sees a slip coming, says so early and renegotiates is a different hire from someone who goes quiet. Both are recorded.',
      },
      {
        title: 'Verified, not self-reported',
        body: 'Tasks are checked against their own acceptance criteria using the commits, tests and CI. A commit is not proof that something works.',
      },
      {
        title: 'Difficulty they can actually handle',
        body: 'Tasks carry a difficulty, so you see where somebody is reliable and where they start to struggle. That line moves as they improve.',
      },
      {
        title: 'AI fluency, measured honestly',
        body: 'Everyone uses AI. What separates candidates is whether they catch what it gets wrong. That is observable, and it is what gets recorded.',
      },
    ],
    cta: { label: 'See how the record works', href: '/how-it-works' },
  },
}

/** The board mock. Four columns, because Submitted and Verified being
 *  different columns is the single idea most worth showing. */
const BOARD: { label: string; tone: 'idle' | 'active' | 'check' | 'done'; tasks: string[] }[] = [
  { label: 'Backlog', tone: 'idle', tasks: ['Rate limiting', 'Deploy'] },
  { label: 'Doing', tone: 'active', tasks: ['Google OAuth'] },
  { label: 'Submitted', tone: 'check', tasks: ['Event API'] },
  { label: 'Verified', tone: 'done', tasks: ['Schema', 'Search'] },
]

export function TheExternship({ audience }: { audience: Audience }) {
  const copy = FRAMING[audience]

  return (
    <section className="wm-section" style={{ paddingTop: 0 }}>
      <div className="wm-section-inner">
        <div className="wm-externship">
          {/* ── Live today ─────────────────────────────────────────────── */}
          <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.05fr)', gap: 52, alignItems: 'center' }} className="mob-1col">
            <div>
              <span className="wm-eyebrow-2">{copy.eyebrow}</span>
              <h2 className="wm-h2">{copy.headline}</h2>
              <p className="wm-lede" style={{ marginBottom: 26 }}>{copy.lede}</p>
              <Link href={copy.cta.href} className="wm-cta-primary">{copy.cta.label}</Link>
            </div>

            <div>
              {/* The card in the clothes it wears in the product. A picture
                  of the feature beats a paragraph about it. */}
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                {copy.steps.map((step) => (
                  <div key={step.title} className="wm-ext-step">
                    <p style={{ fontFamily: F.sans, fontSize: 13.5, fontWeight: 600, color: C.text, marginBottom: 3 }}>{step.title}</p>
                    <p style={{ fontFamily: F.sans, fontSize: 12.5, color: C.textFaint, lineHeight: 1.55 }}>{step.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Not built, and unmistakably labelled ───────────────────── */}
          <div className="wm-ext-soon">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 26 }}>
              <div style={{ minWidth: 0, maxWidth: '50ch', flex: '1 1 420px' }}>
                <span className="wm-soon-badge">{copy.soonEyebrow}</span>
                <h3 style={{ fontFamily: F.serif, fontSize: 26, fontWeight: 600, letterSpacing: '-0.022em', color: C.text, lineHeight: 1.2, margin: '12px 0 10px', textWrap: 'pretty' }}>
                  {copy.soonHeadline}
                </h3>
                <p style={{ fontFamily: F.sans, fontSize: 15.5, color: C.textMuted, lineHeight: 1.62, textWrap: 'pretty' }}>
                  {copy.soonLede}
                </p>
              </div>

              {/* Backlog → Doing → Submitted → Verified. Submitted and
                  Verified being separate columns is the one idea here most
                  worth showing rather than saying. */}
              <div className="wm-board" aria-hidden="true">
                {BOARD.map((column) => (
                  <div key={column.label} className="wm-board-col">
                    <p className="wm-board-label">{column.label}</p>
                    {column.tasks.map((task) => (
                      <span key={task} className={`wm-board-task wm-board-task-${column.tone}`}>{task}</span>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }} className="mob-1col">
              {copy.soonPoints.map((point) => (
                <div key={point.title} className="wm-ext-step wm-ext-step-soon">
                  <p style={{ fontFamily: F.sans, fontSize: 13.5, fontWeight: 600, color: C.textSub, marginBottom: 4 }}>{point.title}</p>
                  <p style={{ fontFamily: F.sans, fontSize: 12.5, color: C.textFaint, lineHeight: 1.55 }}>{point.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
