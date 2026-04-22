import Link from 'next/link'
import { C, F } from './tokens'

const studentPoints = [
  'Always free — every student gets full access to every opportunity on Workmark',
  'Grindable: stack verified Workmark records with every project, paid or unpaid, short or long',
  'No connections required — apply on merit, get evaluated on real work',
  'Your Workmark record is permanent and portable — yours forever, wherever you go next',
  'Built especially for first-gen students, F-1 international students, and non-target school students who are shut out of traditional recruiting',
]

const orgPoints = [
  'No placement fee — ever. Post projects and work with students without an agency in the middle.',
  'Flexible engagements — 4 to 16 weeks, paid or unpaid, remote or onsite',
  'Students are motivated CS learners who want hands-on project experience',
  'Workmark verifies the engagement at close — both sides get a permanent record of the work',
  'Free to start — post your first projects at no cost, no credit card required',
  'Built for SMBs, nonprofits, research labs, and startups that need CS help but not a full-time hire',
]

function Arrow() {
  return <span aria-hidden="true" style={{ color: C.accent, flexShrink: 0, fontFamily: F.mono, fontSize: 12, marginTop: 2 }}>→</span>
}

export function WhoItFor() {
  return (
    <section id="for-you" aria-labelledby="who-its-for-heading" style={{ borderTop: `1px solid ${C.border}`, padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
      <h2 id="who-its-for-heading" style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 48 }}>
        Who Workmark is for
      </h2>
      <div className="mob-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
        {/* Students */}
        <div className="reveal-item" style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 36 }}>
          <div style={{ fontFamily: F.mono, fontSize: 10, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>CS Students</div>
          <h3 style={{ fontFamily: F.serif, fontSize: 26, fontWeight: 600, color: C.text, lineHeight: 1.25, marginBottom: 12 }}>
            Make work experience grindable.
          </h3>
          <p style={{ fontSize: 14, color: C.textFaint, lineHeight: 1.65, marginBottom: 24 }}>
            Every project you complete on Workmark adds a verified, employer-confirmed record to your profile. Permanent. Stackable. Yours forever.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
            {studentPoints.map(p => (
              <div key={p} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, color: C.textMuted, lineHeight: 1.55 }}>
                <Arrow />
                {p}
              </div>
            ))}
          </div>
          <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: C.accent, textDecoration: 'none', fontFamily: F.mono }}>
            Start for free →
          </Link>
        </div>

        {/* Organizations */}
        <div className="reveal-item" style={{ transitionDelay: '0.15s', background: C.surface, border: `1px solid ${C.border}`, padding: 36 }}>
          <div style={{ fontFamily: F.mono, fontSize: 10, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>SMBs &amp; Organizations</div>
          <h3 style={{ fontFamily: F.serif, fontSize: 26, fontWeight: 600, color: C.text, lineHeight: 1.25, marginBottom: 12 }}>
            Real CS help. No agency markup.
          </h3>
          <p style={{ fontSize: 14, color: C.textFaint, lineHeight: 1.65, marginBottom: 24 }}>
            Post a project or internship on Workmark. Motivated CS students apply. The work gets done. Workmark keeps a permanent verified record for both sides.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
            {orgPoints.map(p => (
              <div key={p} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, color: C.textMuted, lineHeight: 1.55 }}>
                <Arrow />
                {p}
              </div>
            ))}
          </div>
          <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: C.accent, textDecoration: 'none', fontFamily: F.mono }}>
            Post a project →
          </Link>
        </div>
      </div>
    </section>
  )
}
