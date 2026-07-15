import { C, F } from './tokens'

const steps = [
  {
    n: '01',
    title: 'Organizations post a project',
    body: 'SMBs, startups, nonprofits, and research labs post real CS projects or internships on Workmark, setting the scope, duration, and skills needed. No agency. No recruiter. Free to start.',
  },
  {
    n: '02',
    title: 'CS students apply and do real work',
    body: 'Students browse Workmark and apply on merit. They tackle real CS problems for organizations that genuinely need the help. Real value is created on both sides of the engagement.',
  },
  {
    n: '03',
    title: 'Both sides win, permanently',
    body: "At project close, the employer confirms the engagement on Workmark: one button. Duration and skills lock permanently to the student's Workmark record. The organization got the work done. The student has verified proof they built it.",
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-it-works-heading" style={{ borderTop: `1px solid ${C.border}`, padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
      <h1 id="how-it-works-heading" style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 48 }}>
        How Workmark works
      </h1>
      <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 40 }}>
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
