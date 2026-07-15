import { C, F } from './tokens'

const types = [
  {
    duration: '4-8 weeks',
    label: 'Short Project',
    body: 'A focused deliverable: a feature, a data pipeline, a prototype. SMBs get real CS output. Students earn their first Workmark record. Ideal for both sides trying the platform for the first time.',
  },
  {
    duration: '12-16 weeks',
    label: 'Semester Internship',
    body: 'A full-semester engagement aligned with the academic calendar. Organizations get sustained CS support over months. Students earn academic credit eligibility and a substantial Workmark record.',
  },
  {
    duration: '10-12 weeks',
    label: 'Summer Internship',
    body: 'The traditional summer internship format, paid or unpaid, with Workmark verification built in. Real work, real experience, and a permanent record for both sides at the end.',
  },
  {
    duration: 'Ongoing',
    label: 'Part-time Role',
    body: '5-15 hrs/week alongside coursework. A flexible way for organizations to get recurring CS support. Students grind their Workmark record over time: cumulative, permanent, and stackable.',
  },
]

export function EngagementTypes() {
  return (
    <section aria-labelledby="engagement-types-heading" style={{ borderTop: `1px solid ${C.border}`, padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
      <h2 id="engagement-types-heading" style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
        Workmark engagement types
      </h2>
      <p style={{ fontSize: 14, color: C.textFaint, fontFamily: F.mono, marginBottom: 48 }}>
        Every format ends the same way: both sides get a verified, permanent Workmark record.
      </p>
      <div className="mob-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
        {types.map((t, i) => (
          <div
            key={t.label}
            className="reveal-item"
            style={{ transitionDelay: `${i * 0.1}s`, background: C.surface, border: `1px solid ${C.border}`, padding: 24, display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ fontFamily: F.mono, fontSize: 10, color: C.accent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>{t.duration}</div>
            <h3 style={{ fontFamily: F.serif, fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 12 }}>{t.label}</h3>
            <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.65, marginBottom: 20, flex: 1 }}>{t.body}</div>
            <div style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
              Workmark record at completion
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
