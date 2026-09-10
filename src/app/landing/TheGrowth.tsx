'use client'

import { type Audience } from './audience'
import { C, F } from './tokens'
import { LEVELS } from '@/lib/theme/tokens'

/**
 * The record as a map rather than a list.
 *
 * TheRecord above answers "what can you do". This answers the question a
 * student actually has next, which is "what now" — and it is the one thing
 * a CV structurally cannot do, because a CV only ever shows the good half.
 *
 * Three zones, and the order is the argument: what you have proven, what is
 * one project away, and what open work keeps asking for that you have not
 * touched. Workmark already computes all three — levels come from the scan,
 * adjacency from the skill taxonomy's parent links, and demand from what
 * live listings are requiring — so this is a picture of data that exists
 * rather than a diagram of an idea.
 *
 * On the deliberate absence of points, streaks and badges: the pull here is
 * "two projects from Advanced", not "340 XP". The first makes somebody build
 * something; the second makes them log in. On a page whose whole argument is
 * that this signal cannot be gamed, a scoring system that rewards activity
 * would undermine the product it is decorating.
 *
 * Full width on purpose. Every other section on this page is a heading over
 * a two-column grid, and even without card borders that rhythm is what makes
 * a page feel generated. One section that breaks the meter is worth more
 * than another that keeps it.
 */

type Zone = {
  label: string
  hint: string
  tone: 'proven' | 'next' | 'gap'
  skills: [string, 'advanced' | 'intermediate' | 'beginner' | null][]
}

/** Illustrative, and labelled as such. Not a real student's record. */
const ZONES: Zone[] = [
  {
    label: 'Proven',
    hint: 'Read out of work you already did',
    tone: 'proven',
    // Three each. An earlier version had five here against three in the
    // other two columns, which left the right two thirds of the panel empty
    // and made the picture look like it had failed to load.
    skills: [
      ['TypeScript', 'advanced'],
      ['PostgreSQL', 'intermediate'],
      ['React', 'intermediate'],
    ],
  },
  {
    label: 'One project away',
    hint: 'Next to something you can already do',
    tone: 'next',
    skills: [['Redis', null], ['Prisma', null], ['GraphQL', null]],
  },
  {
    label: 'Asked for, not yours yet',
    hint: 'What open projects keep requiring',
    tone: 'gap',
    skills: [['Docker', null], ['Kubernetes', null], ['Go', null]],
  },
]

const LABEL = { advanced: 'Advanced', intermediate: 'Intermediate', beginner: 'Beginner' } as const

/** Advanced skills at the end of each year. The shape is the point: the
 *  record is something that moves, and the movement is the evidence.
 *
 *  Drawn as a full-height track with a fill inside it, not as a bare bar.
 *  A bare bar for a value of zero is either invisible or a three-pixel
 *  sliver that reads as a rendering fault, and giving it a minimum height
 *  would draw something where nothing happened. An empty track says zero. */
const TERMS: [string, number][] = [['1st yr', 0], ['2nd yr', 1], ['3rd yr', 3], ['Now', 6]]
const PEAK = 6
const TRACK = 40

const FRAMING: Record<Audience, { eyebrow: string; headline: string; lede: string; footer: string }> = {
  students: {
    eyebrow: 'Where you are going',
    headline: 'See the edge of what you can do',
    lede: 'Your record is a map, not a list. It shows what is one project away, so the next thing to learn is never a guess.',
    footer: 'Two more projects in PostgreSQL and it moves to Advanced.',
  },
  businesses: {
    eyebrow: 'What you can see',
    headline: 'Including what they cannot do yet',
    lede: 'A CV only shows you the good half. This shows the edge as well, so you find out now rather than in month two.',
    footer: 'Two more projects in PostgreSQL and it moves to Advanced.',
  },
}

function Chip({ name, level, tone }: { name: string; level: keyof typeof LABEL | null; tone: Zone['tone'] }) {
  // Proven skills wear the product's real chip. The other two are the same
  // shape with the fill removed, so the difference reads as "not filled in
  // yet" rather than as three unrelated styles.
  if (tone === 'proven' && level) {
    const t = LEVELS[level]
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'baseline', gap: 6,
        fontFamily: F.sans, fontSize: 13, fontWeight: 600, lineHeight: 1.25,
        padding: '6px 11px', borderRadius: 8,
        background: t.fill, border: `1px solid ${t.border}`, color: t.text, boxShadow: t.shadow,
      }}>
        {name}
        <span style={{ fontSize: 11, color: t.sub }}>{LABEL[level]}</span>
      </span>
    )
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontFamily: F.sans, fontSize: 13, fontWeight: 600, lineHeight: 1.25,
      padding: '6px 11px', borderRadius: 8,
      background: 'transparent',
      border: `1px ${tone === 'gap' ? 'dashed' : 'solid'} ${tone === 'gap' ? '#D8D4E8' : '#C9C3E8'}`,
      color: tone === 'gap' ? C.textFaint : C.textMuted,
    }}>
      {name}
    </span>
  )
}

export function TheGrowth({ audience }: { audience: Audience }) {
  const framing = FRAMING[audience]

  return (
    // Same tint as the record section above and no top padding, so the two
    // read as one block rather than colliding. Previously the tint edge cut
    // straight through this heading, which is a boundary drawn through a
    // line of text.
    <section className="wm-section" style={{ background: '#FBFBFD', paddingTop: 0 }}>
      <div className="wm-section-inner">
        <div style={{ maxWidth: 620, marginBottom: 34 }}>
          <span className="wm-eyebrow-2">{framing.eyebrow}</span>
          <h2 className="wm-h2">{framing.headline}</h2>
          <p className="wm-lede">{framing.lede}</p>
        </div>

        <div className="wm-map">
          {/* One number, large. The rest of this page is prose at one size;
              a figure that is allowed to be big is what stops a section
              reading as another paragraph. */}
          <div className="wm-map-head">
            <div>
              <p style={{ fontFamily: F.serif, fontSize: 44, fontWeight: 600, letterSpacing: '-0.028em', color: C.text, lineHeight: 1 }}>
                6
              </p>
              <p style={{ fontFamily: F.sans, fontSize: 13.5, color: C.textMuted, marginTop: 6 }}>
                skills at Advanced, from 37 read
              </p>
            </div>

            <div className="wm-terms" aria-hidden="true">
              {TERMS.map(([term, count]) => (
                <div key={term} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                  <div style={{
                    display: 'flex', alignItems: 'flex-end',
                    width: 26, height: TRACK, borderRadius: 4,
                    background: '#EDEBF4', overflow: 'hidden',
                  }}>
                    <div style={{
                      width: '100%',
                      height: `${(count / PEAK) * TRACK}px`,
                      background: count === PEAK ? LEVELS.advanced.bar : '#C9C3E8',
                    }} />
                  </div>
                  <span style={{ fontFamily: F.sans, fontSize: 11.5, color: C.textFaint }}>{term}</span>
                </div>
              ))}
            </div>
            <span className="wm-map-tag">Illustrative</span>
          </div>

          <div className="wm-map-zones">
            {ZONES.map((zone) => (
              <div key={zone.label} className="wm-map-zone">
                <p style={{ fontFamily: F.sans, fontSize: 12, fontWeight: 700, letterSpacing: '0.075em', textTransform: 'uppercase', color: C.textFaint, marginBottom: 4 }}>
                  {zone.label}
                </p>
                <p style={{ fontFamily: F.sans, fontSize: 12.5, color: C.textGhost, marginBottom: 14, lineHeight: 1.5 }}>
                  {zone.hint}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {zone.skills.map(([name, level]) => (
                    <Chip key={name} name={name} level={level} tone={zone.tone} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <p className="wm-map-foot">{framing.footer}</p>
        </div>
      </div>
    </section>
  )
}
