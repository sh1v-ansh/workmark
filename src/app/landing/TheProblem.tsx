import { C, F } from './tokens'

const studentProblems = [
  "CS students can't get entry-level jobs without experience.",
  "Internships go to students with connections or brand-name schools — first-gen and non-target students are locked out.",
  "A résumé is self-reported noise — there's no way to prove you can actually ship code.",
  "Students spend hours filling out applications with no signal back.",
]

const employerProblems = [
  "A single job posting gets ~250 applications, 75–88% from unqualified candidates.",
  "SMBs and startups have no recruiter, no ATS, no time to screen.",
  "Affordable, vetted CS talent is inaccessible without expensive agencies.",
]

function Dot() {
  return <div aria-hidden="true" style={{ width: 5, height: 5, background: C.accent, borderRadius: '50%', flexShrink: 0, marginTop: 7 }} />
}

export function TheProblem() {
  return (
    <section aria-labelledby="the-problem-heading" style={{ borderTop: `1px solid ${C.border}`, padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
      <h2 id="the-problem-heading" style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 48 }}>
        The problem
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64 }}>
        <div className="reveal-item">
          <h3 style={{ fontFamily: F.serif, fontSize: 24, fontWeight: 600, color: C.text, marginBottom: 24, lineHeight: 1.2 }}>For students</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {studentProblems.map(p => (
              <div key={p} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <Dot />
                <span style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.65 }}>{p}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="reveal-item" style={{ transitionDelay: '0.15s' }}>
          <h3 style={{ fontFamily: F.serif, fontSize: 24, fontWeight: 600, color: C.text, marginBottom: 24, lineHeight: 1.2 }}>For employers</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {employerProblems.map(p => (
              <div key={p} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <Dot />
                <span style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.65 }}>{p}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
