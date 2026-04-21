import { C, F } from './tokens'

const steps = [
  ['01', 'Organizations post full-time roles', 'They specify the required tech stack and experience level. Workmark surfaces only students whose verified records match.'],
  ['02', 'Matching runs on verified records only', "Workmark compares the role's requirements against students' attested Workmark records. Skills that were actually used and confirmed by employers — not self-reported."],
  ['03', 'Students apply in one tap', 'Students get notified when they\'re a strong match. They tap apply. Their Workmark record is their application — no form to fill out, no cover letter needed.'],
  ['04', 'Organizations see a small, qualified pool', 'A handful of candidates — each with a verified, employer-confirmed Workmark record. Less screening, more signal.'],
]

const matchTags = ['React', 'TypeScript', 'SQL']

export function JobMatching() {
  return (
    <section style={{ borderTop: `1px solid ${C.border}`, padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
      <div className="reveal-item">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Workmark job matching
          </div>
          <span style={{ fontFamily: F.mono, fontSize: 9, color: C.textMuted, background: C.surfaceAlt, border: `1px solid ${C.border}`, padding: '2px 8px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Coming soon
          </span>
        </div>
        <h2 className="mob-text-h1" style={{ fontFamily: F.serif, fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, color: C.text, marginBottom: 16, maxWidth: 500 }}>
          Your Workmark record is<br />your application.
        </h2>
        <p style={{ fontSize: 14, color: C.textFaint, fontFamily: F.mono, marginBottom: 48 }}>
          Workmark job matching is in development. Once live, your verified records automatically match you to full-time roles — no form to fill out.
        </p>
      </div>

      <div className="mob-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'start' }}>
        <div className="reveal-item" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {steps.map(([n, title, body]) => (
            <div key={n} style={{ display: 'flex', gap: 16 }}>
              <div style={{ fontFamily: F.mono, fontSize: 11, color: C.accent, marginTop: 2, flexShrink: 0 }}>{n}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.textSub, marginBottom: 4 }}>{title}</div>
                <div style={{ fontSize: 13, color: C.textFaint, lineHeight: 1.65 }}>{body}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="reveal-item" style={{ transitionDelay: '0.15s', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Match notification mockup */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 24 }}>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
              Match notification
            </div>
            <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, padding: 16, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: C.accent, letterSpacing: '0.06em' }}>STRONG MATCH</div>
                <div style={{ fontFamily: F.mono, fontSize: 12, color: C.accent, fontWeight: 700 }}>94%</div>
              </div>
              <div style={{ fontSize: 14, color: C.text, fontWeight: 500, marginBottom: 3 }}>Full-Stack Engineer</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>Seed-stage SaaS · Remote</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {matchTags.map(s => (
                  <span key={s} style={{ fontSize: 10, padding: '2px 7px', background: C.bg, border: `1px solid ${C.border}`, color: C.textSub, fontFamily: F.mono }}>✓ {s}</span>
                ))}
              </div>
              <div style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>Based on 2 verified engagements</div>
            </div>
            <div style={{ width: '100%', padding: '10px 0', background: C.accent, color: C.bg, border: 'none', fontFamily: F.mono, fontSize: 12, fontWeight: 500, letterSpacing: '0.06em', textAlign: 'center' }}>
              ONE-TAP APPLY →
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: C.textFaint, fontFamily: F.mono, textAlign: 'center' }}>
              No form. Your verified record is your application.
            </div>
          </div>

          {/* Employer view */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 20 }}>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
              What the employer sees
            </div>
            <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.65 }}>
              3–8 candidates. Every one verified. No résumé parsing, no keyword matching, no screening calls to filter the unqualified out.
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
