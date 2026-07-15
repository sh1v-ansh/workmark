'use client'

import { C, F } from './tokens'

const stats = [
  {
    figure: '40%',
    label: 'of résumés contain misleading or false information',
    source: 'ResumeLab survey, 2023',
  },
  {
    figure: '250',
    label: 'résumés received per corporate job opening, on average',
    source: 'Glassdoor / Jobvite',
  },
  {
    figure: '75%',
    label: 'of résumés are never seen by a human — filtered by ATS keywords',
    source: 'ATS industry estimates',
  },
]

export function HiringProblem() {
  return (
    <section style={{ borderTop: `1px solid ${C.border}`, background: C.surfaceAlt, padding: '96px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div className="reveal-item" style={{ maxWidth: 760, marginBottom: 64 }}>
          <div className="wm-eyebrow" style={{ marginBottom: 22 }}>The problem</div>
          <h2 className="mob-text-h1" style={{ fontFamily: F.serif, fontSize: 46, fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.03em', color: C.text, margin: '0 0 20px' }}>
            Hiring runs on documents nobody can trust.
          </h2>
          <p style={{ fontSize: 18, lineHeight: 1.7, color: C.textMuted }}>
            A résumé is a self-reported list of claims. Employers can&apos;t verify them, so they
            fall back on brand-name schools, referrals, and keyword filters — and talented
            students without the right pedigree get filtered out before anyone sees their work.
          </p>
        </div>

        <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {stats.map((s) => (
            <div key={s.figure} className="reveal-item wm-card" style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 28 }}>
              <div style={{ fontFamily: F.sans, fontSize: 60, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em', color: C.accent, marginBottom: 16 }}>
                {s.figure}
              </div>
              <p style={{ fontSize: 15, lineHeight: 1.55, color: C.textSub, marginBottom: 14 }}>{s.label}</p>
              <p style={{ fontFamily: F.sans, fontSize: 12, color: C.textFaint }}>{s.source}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
