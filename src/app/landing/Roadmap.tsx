'use client'

import { C, F } from './tokens'

const phases = [
  {
    tag: 'Now',
    active: true,
    title: 'Students ↔ students',
    body: 'Students post projects and hire each other. The first verified records are earned peer-to-peer — building the dataset and proving the model with the people who need experience most.',
  },
  {
    tag: 'Next',
    active: false,
    title: 'Organizations join',
    body: 'SMBs, startups, and nonprofits post real work and attest records. Students get affordable, meaningful experience; organizations get vetted CS talent without agency fees.',
  },
  {
    tag: 'The vision',
    active: false,
    title: 'The hiring layer',
    body: 'With millions of verified records, Workmark becomes the trusted signal employers hire on — matching, filtering, and verification all built on proof instead of pedigree.',
  },
]

export function Roadmap() {
  return (
    <section style={{ borderTop: `1px solid ${C.border}`, padding: '96px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div className="reveal-item" style={{ maxWidth: 760, marginBottom: 56 }}>
          <div className="wm-eyebrow" style={{ marginBottom: 22 }}>How we get there</div>
          <h2 className="mob-text-h1" style={{ fontFamily: F.serif, fontSize: 46, fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.03em', color: C.text, margin: '0 0 20px' }}>
            Start with students. Then the whole market.
          </h2>
          <p style={{ fontSize: 18, lineHeight: 1.7, color: C.textMuted }}>
            The fastest way to build a trusted record database is to start where the need is
            sharpest — students helping students — and expand outward from proven ground.
          </p>
        </div>

        <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {phases.map((p, i) => (
            <div
              key={p.title}
              className="reveal-item"
              style={{
                position: 'relative',
                background: p.active ? C.accent : '#fff',
                border: `1px solid ${p.active ? C.accent : C.border}`,
                borderRadius: 16,
                padding: 30,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <span style={{ width: 28, height: 28, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.sans, fontSize: 12, fontWeight: 700, background: p.active ? 'rgba(255,255,255,0.2)' : C.accentHover, color: p.active ? '#fff' : C.accent }}>
                  {i + 1}
                </span>
                <span style={{ fontFamily: F.sans, fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: p.active ? 'rgba(255,255,255,0.85)' : C.textFaint }}>
                  {p.tag}
                </span>
              </div>
              <h3 style={{ fontFamily: F.serif, fontSize: 24, fontWeight: 700, color: p.active ? '#fff' : C.text, margin: '0 0 12px' }}>
                {p.title}
              </h3>
              <p style={{ fontSize: 14.5, lineHeight: 1.65, color: p.active ? 'rgba(255,255,255,0.9)' : C.textMuted, margin: 0 }}>
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
