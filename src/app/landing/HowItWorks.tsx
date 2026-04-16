import { C, F } from './tokens'

const steps = [
  {
    n: '01',
    title: 'Do real CS work',
    body: 'Browse and apply to internships and contract projects at SMBs, startups, and nonprofits. 4–16 week engagements, paid or unpaid.',
  },
  {
    n: '02',
    title: 'Build a verified record',
    body: "At project close, the employer confirms the engagement — attesting to the stack used and quality of work. You don't submit anything. They just confirm.",
  },
  {
    n: '03',
    title: 'Get matched, one tap',
    body: 'Your verified records automatically match you to full-time roles. Only students with qualifying records can apply — so every application counts.',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" style={{ borderTop: `1px solid ${C.border}`, padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 48 }}>
        How it works
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 40 }}>
        {steps.map((s, i) => (
          <div
            key={s.n}
            className="reveal-item"
            style={{ transitionDelay: `${i * 0.15}s` }}
          >
            <div style={{ fontFamily: F.mono, fontSize: 11, color: C.accent, letterSpacing: '0.1em', marginBottom: 16 }}>{s.n}</div>
            <h3 style={{ fontFamily: F.serif, fontSize: 22, fontWeight: 600, color: C.text, marginBottom: 12 }}>{s.title}</h3>
            <p style={{ fontSize: 15, lineHeight: 1.65, color: C.textMuted }}>{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
