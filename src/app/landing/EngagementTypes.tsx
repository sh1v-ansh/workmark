import { C, F } from './tokens'

const types = [
  { duration: '4–8 weeks', label: 'Short Project', body: 'A focused deliverable — a feature, a data pipeline, a prototype. Ideal for first engagements.' },
  { duration: '12–16 weeks', label: 'Semester Internship', body: 'Full-semester engagement aligned with the academic calendar. Internship credit eligible.' },
  { duration: '10–12 weeks', label: 'Summer Internship', body: 'The traditional summer internship, now with verification built in. Paid or unpaid.' },
  { duration: 'Ongoing', label: 'Part-time Role', body: '5–15 hrs/week alongside coursework. Recurring attestations build a richer record over time.' },
]

export function EngagementTypes() {
  return (
    <section style={{ borderTop: `1px solid ${C.border}`, padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 48 }}>
        Engagement types
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
        {types.map((t, i) => (
          <div
            key={t.label}
            className="reveal-item"
            style={{ transitionDelay: `${i * 0.1}s`, background: C.surface, border: `1px solid ${C.border}`, padding: 24, display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ fontFamily: F.mono, fontSize: 10, color: C.accent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>{t.duration}</div>
            <div style={{ fontFamily: F.serif, fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 12 }}>{t.label}</div>
            <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.65, marginBottom: 20, flex: 1 }}>{t.body}</div>
            <div style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
              Attestation at completion
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
