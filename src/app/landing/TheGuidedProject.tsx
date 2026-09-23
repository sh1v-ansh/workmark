'use client'

import Link from 'next/link'
import { type Audience } from './audience'
import { C, F } from './tokens'

/**
 * The guided project, given the room it deserves.
 *
 * Deliberately NOT called an externship or an internship. Those words carry
 * meaning Workmark does not deliver and cannot promise — an internship is an
 * employment relationship, and for an international student on an F-1 visa
 * calling this one would imply work authorisation they may not have. A
 * guided project is exactly what this is: a real project, planned with you,
 * that produces real evidence. No employer, no paperwork, nobody to ask.
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
    eyebrow: 'Guided projects',
    headline: 'Start a guided project today, no application needed',
    lede:
      'We give you a real project at your skill level. Build it alone or with other students, and it counts on your profile like any other work.',
    steps: [
      {
        title: 'We pick a project for your level',
        body: 'It is matched to the skills you have and the skills open projects ask for.',
      },
      {
        title: 'You build it in your own repository',
        body: 'Your code stays yours. Link the repository and we read what you build.',
      },
      {
        title: 'It counts like real work',
        body: 'Same scan and same skill levels as everything else on your profile.',
      },
    ],
    soonEyebrow: 'Inside your workspace',
    soonHeadline: 'Work on your project the way a real team works',
    soonLede:
      'Every guided project comes with a workspace, a task board and an AI tech lead who reviews your work.',
    soonPoints: [
      {
        title: 'An AI tech lead who plans with you',
        body: 'It splits the project into tasks and hands you one or two at a time. Edit anything you want.',
      },
      {
        title: 'A board that shows where you are',
        body: 'Backlog, Doing, Submitted and Verified, with your own estimates and deadlines.',
      },
      {
        title: 'Build it with other students',
        body: 'Invite teammates to the same project. Everyone gets credit for the commits they wrote.',
      },
      {
        title: 'Help when you are stuck',
        body: 'Flag a blocker and your tech lead helps you break the problem down.',
      },
      {
        title: 'Finished work gets checked',
        body: 'Submit a task and your tech lead checks your commits against what the task asked for.',
      },
      {
        title: 'Use AI tools freely',
        body: 'Claude, Copilot and Cursor are all fine. What counts is the working code you ship.',
      },
    ],
    cta: { label: 'Get my first project', href: '/login' },
  },

  businesses: {
    eyebrow: 'Guided projects',
    headline: 'See how candidates plan, build and finish real projects',
    lede:
      'Students build guided projects in a workspace with an AI tech lead. You see the finished work and how they got there.',
    steps: [
      {
        title: 'Projects matched to a skill and level',
        body: 'Each project targets a specific skill, so similar projects show similar ability.',
      },
      {
        title: 'Built in the candidate’s own repository',
        body: 'Every commit is attributed to the person who wrote it.',
      },
      {
        title: 'Checked like everything else',
        body: 'Guided work goes through the same scan and the same levels as paid work.',
      },
    ],
    soonEyebrow: 'What the workspace records',
    soonHeadline: 'See how they work, not just what they shipped',
    soonLede:
      'The questions you would ask on a reference call, answered by what happened on the project.',
    soonPoints: [
      {
        title: 'See if they hit their estimates',
        body: 'They said four hours and it took seven. You see whether their estimates improve over time.',
      },
      {
        title: 'See if they finish what they start',
        body: 'Commitments made, met or dropped, counted across every project.',
      },
      {
        title: 'See how they handle problems',
        body: 'Someone who flags a slip early and recovers looks different from someone who goes quiet.',
      },
      {
        title: 'See work checked against the task',
        body: 'Each task is checked against its own acceptance criteria using commits, tests and CI.',
      },
      {
        title: 'See the difficulty they can handle',
        body: 'Tasks carry a difficulty, so you see where someone is reliable and where they struggle.',
      },
      {
        title: 'See how well they use AI',
        body: 'Everyone uses AI. You see whether they catch what it gets wrong.',
      },
    ],
    cta: { label: 'See how profiles work', href: '/how-it-works' },
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

export function TheGuidedProject({ audience }: { audience: Audience }) {
  const copy = FRAMING[audience]

  return (
    <section className="wm-section">
      <div className="wm-section-inner">
        <div className="wm-guided">
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
