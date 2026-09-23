import type { Metadata } from 'next'
import Link from 'next/link'
import { MarketingLayout } from '../landing/MarketingLayout'
import { TeamSection } from '../landing/TeamSection'
import { Aurora } from '../landing/Aurora'
import { C, F } from '../landing/tokens'

export const metadata: Metadata = {
  title: 'About',
  description:
    'Workmark is built by Shivansh Soni and Jineshwar Nariani, two students who got tired of applying for jobs. Opportunities should find students, at whatever level they are.',
}

/**
 * About: who built this and why, kept short.
 *
 * The story is the founders' own, trimmed to what a stranger needs: the
 * problem they lived, and what Workmark does about it. Same type and colour
 * as the rest of the marketing site, with more white space, because this is
 * a page to read rather than to scan.
 */
const STORY = [
  'In college, we were balancing classes with the things that actually prepare you for a job: projects, internships, hackathons and research. Each one lived in a different place, with its own application and its own wait.',
  'Keeping up was exhausting. Applying took as much time as the work itself, and most applications never got a reply. Hiring teams had it hard too, reading piles of resumes that all looked the same.',
  'So we started building the platform we wished we had. You build real skills here, your work becomes a verified profile, and opportunities find you at whatever level you are.',
]

export default function AboutPage() {
  return (
    <MarketingLayout>
      {/* ── Header ── */}
      <section style={{ position: 'relative', overflow: 'hidden', padding: '120px 24px 72px', textAlign: 'center' }}>
        <Aurora height={640} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 780, margin: '0 auto' }}>
          <span className="wm-eyebrow-2">About Workmark</span>
          <h1
            className="mob-text-hero"
            style={{
              fontFamily: F.serif, fontSize: 52, fontWeight: 600, lineHeight: 1.08,
              letterSpacing: '-0.028em', color: C.text, margin: '0 0 20px', textWrap: 'balance',
            }}
          >
            Applying for jobs shouldn’t be{' '}
            <span style={{
              background: 'linear-gradient(103deg, #3E1FFF 0%, #7F5CFF 42%, #EC4899 100%)',
              WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
            }}>
              a second full-time job.
            </span>
          </h1>
          <p style={{ fontFamily: F.sans, fontSize: 18.5, lineHeight: 1.62, color: C.textMuted, maxWidth: 580, margin: '0 auto', textWrap: 'pretty' }}>
            We are two students who got tired of chasing opportunities. So we are building a place
            where they find you instead.
          </p>
        </div>
      </section>

      {/* ── The story ── */}
      <section className="wm-section" style={{ paddingTop: 24 }}>
        <div style={{ maxWidth: 660, margin: '0 auto' }}>
          <span className="wm-eyebrow-2">Our story</span>
          <h2 className="wm-h2" style={{ marginBottom: 22 }}>Why we built Workmark</h2>
          <div style={{ display: 'grid', gap: 18 }}>
            {STORY.map((paragraph) => (
              <p key={paragraph.slice(0, 24)} style={{ fontFamily: F.sans, fontSize: 17, lineHeight: 1.72, color: '#3F3F4A', textWrap: 'pretty' }}>
                {paragraph}
              </p>
            ))}
          </div>

          <figure
            style={{
              margin: '38px 0 0', padding: '24px 26px', borderRadius: 16,
              background: 'linear-gradient(160deg, rgba(246,242,255,0.9) 0%, rgba(255,255,255,0.9) 100%)',
              border: '1px solid rgba(62,31,255,0.12)',
              boxShadow: '0 1px 2px rgba(25,30,46,0.03), 0 18px 40px -26px rgba(62,31,255,0.35)',
            }}
          >
            <blockquote style={{ margin: 0, fontFamily: F.serif, fontSize: 22, fontWeight: 600, lineHeight: 1.4, letterSpacing: '-0.016em', color: C.text, textWrap: 'pretty' }}>
              Opportunities should find students at whatever level they are, instead of students
              always having to go looking for them.
            </blockquote>
            <figcaption style={{ marginTop: 12, fontFamily: F.sans, fontSize: 14, color: C.textMuted }}>
              Shivansh and Jineshwar, founders
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ── Who ── */}
      <TeamSection compact />

      {/* ── Closing ── */}
      <section className="wm-section" style={{ paddingTop: 12, textAlign: 'center' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <p style={{ fontFamily: F.sans, fontSize: 17, lineHeight: 1.65, color: C.textMuted, marginBottom: 22 }}>
            Questions, ideas, or want to work with us? Write to{' '}
            <a href="mailto:support@workmark.org" style={{ color: C.accent, textDecoration: 'none', fontWeight: 600 }}>
              support@workmark.org
            </a>.
          </p>
          <div style={{ display: 'flex', gap: 11, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/login" className="wm-cta-primary">Join as a student</Link>
            <Link href="/marketplace" className="wm-cta-ghost">Hire through Workmark</Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  )
}
