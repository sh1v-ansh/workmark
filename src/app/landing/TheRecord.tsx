'use client'

import { type Audience } from './audience'
import { C, F } from './tokens'
import { LEVELS } from '@/lib/theme/tokens'

/**
 * What a record actually looks like.
 *
 * This replaced three borrowed statistics — 40% of résumés mislead, 250 per
 * opening, 75% never seen by a human — each with a citation under it. They
 * were honestly sourced and they were still the wrong opening, because a
 * product whose entire claim is "we replace unverifiable claims with
 * checkable ones" cannot lead with three numbers the reader has to take on
 * faith. One of the three was cited to "ATS industry estimates", which is
 * not a source.
 *
 * So: show the thing. A record, its levels, and the line underneath that
 * says where one of them came from. The argument makes itself, and there is
 * nothing here a reader has to believe.
 *
 * The skills below are illustrative and say so. They are not a real
 * student's record and must never be presented as one.
 */

// Two gold in nine, matching the bar above them. An earlier version showed
// three in eight, which is more than double the rate the bar claims — and
// gold only means anything because it is rare, so a sample that inflates it
// argues against the thing the section is trying to say.
const SKILLS: [string, 'advanced' | 'intermediate' | 'beginner'][] = [
  ['TypeScript', 'advanced'],
  ['PostgreSQL', 'advanced'],
  ['React', 'intermediate'],
  ['Docker', 'intermediate'],
  ['Python', 'intermediate'],
  ['pytest', 'intermediate'],
  ['Redis', 'beginner'],
  ['Go', 'beginner'],
  ['Kafka', 'beginner'],
]

const LABEL = { advanced: 'Advanced', intermediate: 'Intermediate', beginner: 'Beginner' } as const

/** Same record, two readings of it. The demonstration is identical because
 *  it is the same artifact — what changes is who is being told what it is
 *  for, which is exactly the difference the page exists to draw. */
const FRAMING: Record<Audience, { eyebrow: string; headline: string; lede: string; points: [string, string][] }> = {
  students: {
    eyebrow: 'What you get',
    headline: 'A skill record with its working shown',
    lede: 'Every line says where it came from. Not "proficient in PostgreSQL" — the project, the level, and how it was checked, so a poster can look instead of taking your word for it.',
    points: [
      ['We read what your code depends on', 'How it is built, which files import what, and which commits are yours. Never the source itself.'],
      ['Three levels, and only one is earned easily', 'Advanced means sustained work that survived other people\u2019s code, tests and mistakes.'],
      ['You can challenge any of it', 'It is your record. If a line is wrong, there is a page for saying so and a person who reads it.'],
    ],
  },
  businesses: {
    eyebrow: 'What you see',
    headline: 'What an applicant looks like here',
    lede: 'This is what arrives instead of a CV. Every skill carries the project it came from, the level it reached and how that was established — so the first question is whether the evidence is enough, not whether the claim is true.',
    points: [
      ['Read from repositories, not from a form', 'Dependency graphs, build configuration, commit authorship and test coverage. Nobody types their own skill level.'],
      ['Levels mean the same thing across candidates', 'Calibrated against every record on the platform, and recalibrated as more work comes in.'],
      ['The gaps are shown too', 'You see what somebody cannot do yet, which is the half a CV never tells you.'],
    ],
  },
}

export function TheRecord({ audience }: { audience: Audience }) {
  const framing = FRAMING[audience]
  return (
    <section className="wm-section" style={{ background: '#FBFBFD', borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
      <div className="wm-section-inner">
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.05fr)', gap: 60, alignItems: 'center' }} className="mob-1col">
          <div>
            <span className="wm-eyebrow-2">{framing.eyebrow}</span>
            <h2 className="wm-h2">{framing.headline}</h2>
            <p className="wm-lede" style={{ marginBottom: 22 }}>{framing.lede}</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {framing.points.map(([t, d]) => (
                <li key={t} style={{ display: 'flex', gap: 11 }}>
                  <span aria-hidden="true" style={{ flexShrink: 0, marginTop: 6, width: 6, height: 6, borderRadius: 999, background: C.accent }} />
                  <span>
                    <span style={{ display: 'block', fontFamily: F.sans, fontSize: 14.5, fontWeight: 600, color: C.text, marginBottom: 2 }}>{t}</span>
                    <span style={{ display: 'block', fontFamily: F.sans, fontSize: 13.5, color: C.textFaint, lineHeight: 1.55 }}>{d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* The record itself. Same chips, same gold, same rules as the
              product — it is the actual design, not a drawing of it. */}
          <div className="wm-record-card">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <span>
                <span style={{ fontFamily: F.serif, fontSize: 27, fontWeight: 600, letterSpacing: '-0.022em', color: C.text }}>37</span>
                <span style={{ fontFamily: F.sans, fontSize: 13.5, color: C.textMuted, marginLeft: 8 }}>skills, read from 12 projects</span>
              </span>
              <span style={{ fontFamily: F.sans, fontSize: 12, color: C.textFaint }}>Illustrative</span>
            </div>

            <div style={{ display: 'flex', height: 7, borderRadius: 999, overflow: 'hidden', marginBottom: 18 }}>
              <div style={{ width: '16%', background: LEVELS.advanced.bar }} />
              <div style={{ width: '38%', background: LEVELS.intermediate.bar }} />
              <div style={{ width: '46%', background: LEVELS.beginner.bar }} />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
              {SKILLS.map(([name, level]) => {
                const tone = LEVELS[level]
                return (
                  <span
                    key={name}
                    style={{
                      display: 'inline-flex', alignItems: 'baseline', gap: 6,
                      fontFamily: F.sans, fontSize: 13, fontWeight: 600, lineHeight: 1.25,
                      padding: '6px 11px', borderRadius: 8,
                      background: tone.fill, border: `1px solid ${tone.border}`,
                      color: tone.text, boxShadow: tone.shadow,
                    }}
                  >
                    {name}
                    <span style={{ fontSize: 11, color: tone.sub }}>{LABEL[level]}</span>
                  </span>
                )
              })}
              <span style={{ fontFamily: F.sans, fontSize: 12.5, color: C.textFaint, padding: '6px 4px' }}>+28 more</span>
            </div>

            {/* The provenance line. This is the product in one row. */}
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
              <p style={{ fontFamily: F.sans, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.075em', textTransform: 'uppercase', color: C.textFaint, marginBottom: 8 }}>
                Where PostgreSQL came from
              </p>
              <div style={{ background: '#F7F7FA', borderRadius: 9, padding: '11px 13px' }}>
                <p style={{ fontFamily: F.sans, fontSize: 13.5, fontWeight: 600, color: C.accent, marginBottom: 3 }}>ada/lab-inventory</p>
                <p style={{ fontFamily: F.sans, fontSize: 12.5, color: C.textFaint, lineHeight: 1.5 }}>
                  Multi-contributor project · Read from the repository · 41 commits over 9 weeks
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
