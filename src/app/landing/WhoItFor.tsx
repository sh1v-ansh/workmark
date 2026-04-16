import Link from 'next/link'
import { C, F } from './tokens'

const studentPoints = [
  'Always free — no paywalls, ever',
  'Works for F-1 students and international students',
  'Verified skills outweigh unverified ones in matching',
  'Records are yours forever — portable and permanent',
  'No connections required. Non-target schools welcome.',
]

const orgPoints = [
  'Post projects or semester internships',
  'Every applicant has a verified track record',
  'EIN-verified organizations only — no bad actors',
  'Free to start — 3 postings on the free tier',
  'SMBs, nonprofits, and startups welcome',
]

const orgPlans = [
  ['Free', '3 postings'],
  ['$199/mo', '10 postings'],
  ['$499/mo', 'Unlimited + ATS'],
]

function Arrow() {
  return <span style={{ color: C.accent, flexShrink: 0, fontFamily: F.mono, fontSize: 12, marginTop: 1 }}>→</span>
}

export function WhoItFor() {
  return (
    <section id="for-you" style={{ borderTop: `1px solid ${C.border}`, padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 48 }}>
        Who it&apos;s for
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
        {/* Students */}
        <div className="reveal-item" style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 36 }}>
          <div style={{ fontFamily: F.mono, fontSize: 10, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>Students</div>
          <h3 style={{ fontFamily: F.serif, fontSize: 26, fontWeight: 600, color: C.text, lineHeight: 1.25, marginBottom: 20 }}>
            Prove what you can do.<br />Not where you went to school.
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
            {studentPoints.map(p => (
              <div key={p} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, color: C.textMuted, lineHeight: 1.5 }}>
                <Arrow />
                {p}
              </div>
            ))}
          </div>
          <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: C.accent, textDecoration: 'none', fontFamily: F.mono }}>
            Get started free →
          </Link>
        </div>

        {/* Organizations */}
        <div className="reveal-item" style={{ transitionDelay: '0.15s', background: C.surface, border: `1px solid ${C.border}`, padding: 36 }}>
          <div style={{ fontFamily: F.mono, fontSize: 10, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>Organizations</div>
          <h3 style={{ fontFamily: F.serif, fontSize: 26, fontWeight: 600, color: C.text, lineHeight: 1.25, marginBottom: 20 }}>
            Vetted CS talent.<br />No recruiter required.
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
            {orgPoints.map(p => (
              <div key={p} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, color: C.textMuted, lineHeight: 1.5 }}>
                <Arrow />
                {p}
              </div>
            ))}
          </div>
          <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: C.accent, textDecoration: 'none', fontFamily: F.mono }}>
            Post a project →
          </Link>
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, marginBottom: 12 }}>Organization plans</div>
            <div style={{ display: 'flex', gap: 24 }}>
              {orgPlans.map(([price, desc]) => (
                <div key={price}>
                  <div style={{ fontFamily: F.mono, fontSize: 13, color: C.textSub, fontWeight: 500 }}>{price}</div>
                  <div style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
