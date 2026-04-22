import { C, F } from './tokens'

const studentProblems = [
  "CS students can't get their first internship without prior work experience — the classic entry-level catch-22.",
  "Opportunities go to students at target schools or with the right connections. First-gen and non-target students are locked out.",
  "Without a way to make experience grindable, skilled students stall before they even start.",
  "Real project experience is gated behind networking and prestige most students simply don't have access to.",
]

const orgProblems = [
  "99.9% of U.S. businesses are small businesses — but most are priced out of traditional recruiting agencies. (Source: SBA Office of Advocacy, 2023)",
  "Staffing agencies typically charge 15–25% of first-year salary as placement fees — unaffordable for most small teams.",
  "SMBs often need help with 1–2 CS projects per year, not a full-time hire they can't sustain.",
  "There's no affordable, reliable channel for small organizations to reach motivated CS students.",
]

function Dot() {
  return <div aria-hidden="true" style={{ width: 5, height: 5, background: C.accent, borderRadius: '50%', flexShrink: 0, marginTop: 7 }} />
}

export function TheProblem() {
  return (
    <section aria-labelledby="the-problem-heading" style={{ borderTop: `1px solid ${C.border}`, padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
      <h2 id="the-problem-heading" style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
        Two problems. One solution.
      </h2>
      <p style={{ fontSize: 15, color: C.textMuted, maxWidth: 620, lineHeight: 1.65, marginBottom: 48 }}>
        CS students can&apos;t get experience without experience. SMBs can&apos;t access CS talent without expensive agencies. These two problems solve each other. That&apos;s Workmark.
      </p>
      <div className="mob-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64 }}>
        <div className="reveal-item">
          <h3 style={{ fontFamily: F.serif, fontSize: 24, fontWeight: 600, color: C.text, marginBottom: 24, lineHeight: 1.2 }}>For CS students</h3>
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
          <h3 style={{ fontFamily: F.serif, fontSize: 24, fontWeight: 600, color: C.text, marginBottom: 24, lineHeight: 1.2 }}>For SMBs &amp; organizations</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {orgProblems.map(p => (
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
