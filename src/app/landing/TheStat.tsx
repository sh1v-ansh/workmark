import { C, F } from './tokens'

const secondaryStats = [
  ['85%', 'of employers now use skills-based hiring'],
  ['70M+', 'workers excluded by credential filters'],
  ['~250', 'avg applications per job posting'],
]

export function TheStat() {
  return (
    <section style={{ background: C.bgDeep, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: '100px 24px', textAlign: 'center' }}>
      <div className="reveal-item" style={{ maxWidth: 700, margin: '0 auto' }}>
        <div style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20 }}>
          The problem in one number
        </div>
        <div style={{ fontFamily: F.serif, fontSize: 96, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, color: C.text, marginBottom: 16 }}>
          75–88%
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 15, color: C.textMuted, marginBottom: 24 }}>
          of job applicants are unqualified
        </div>
        <p style={{ fontSize: 16, color: C.textFaint, lineHeight: 1.7, maxWidth: 520, margin: '0 auto 40px' }}>
          On Workmark, only students with verified matching records can apply. Companies see 3–8 candidates, not 250.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 56 }}>
          {secondaryStats.map(([stat, label]) => (
            <div key={stat} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: F.mono, fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 6 }}>{stat}</div>
              <div style={{ fontSize: 12, color: C.textFaint, maxWidth: 120, lineHeight: 1.4 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
