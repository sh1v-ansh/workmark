import type { Metadata } from 'next'
import { MarketingLayout } from '../landing/MarketingLayout'
import { C, F } from '../landing/tokens'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Pricing — Workmark',
  description: 'Workmark is free for students, always. Free for organizations during early access.',
}

export default function PricingPage() {
  return (
    <MarketingLayout>
      {/* Header */}
      <section style={{ borderBottom: `1px solid ${C.border}`, padding: '64px 24px 48px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
          Pricing
        </div>
        <h1 style={{ fontFamily: F.serif, fontSize: 48, fontWeight: 800, letterSpacing: '-0.03em', color: C.text, lineHeight: 1.1, maxWidth: 560, marginBottom: 20 }}>
          Free, for now.
        </h1>
        <p style={{ fontSize: 16, color: C.textMuted, maxWidth: 480, lineHeight: 1.6 }}>
          Workmark is in early access. Nothing costs anything yet — we want to build something useful before we talk about money.
        </p>
      </section>

      {/* Cards */}
      <section aria-label="Plans" style={{ maxWidth: 1100, margin: '0 auto', padding: '56px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, maxWidth: 720 }}>
          {/* Students */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 36 }}>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>Students</div>
            <div style={{ fontFamily: F.serif, fontSize: 36, fontWeight: 800, color: C.text, marginBottom: 4 }}>$0</div>
            <div style={{ fontFamily: F.mono, fontSize: 11, color: C.accent, marginBottom: 28 }}>Always free</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                'Browse all open projects',
                'Apply with your resume',
                'Earn verified experience records',
                'Permanent, employer-attested history',
              ].map((item) => (
                <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: C.textSub }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ marginTop: 2, flexShrink: 0 }}>
                    <path d="M2.5 7l3 3 6-6" stroke={C.accent} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
            <div style={{ marginTop: 32 }}>
              <Link href="/login" style={{ display: 'block', textAlign: 'center', padding: '11px 0', background: C.accent, color: C.bg, fontFamily: F.mono, fontSize: 12, fontWeight: 500, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Get started →
              </Link>
            </div>
          </div>

          {/* Organizations */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 36 }}>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>Organizations</div>
            <div style={{ fontFamily: F.serif, fontSize: 36, fontWeight: 800, color: C.text, marginBottom: 4 }}>$0</div>
            <div style={{ fontFamily: F.mono, fontSize: 11, color: C.textMuted, marginBottom: 28 }}>During early access</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                'Post projects and internships',
                'Review applicants and resumes',
                'Accept or reject with one click',
                'Issue verified experience records',
              ].map((item) => (
                <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: C.textSub }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ marginTop: 2, flexShrink: 0 }}>
                    <path d="M2.5 7l3 3 6-6" stroke={C.textMuted} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
            <div style={{ marginTop: 32 }}>
              <Link href="/login" style={{ display: 'block', textAlign: 'center', padding: '11px 0', background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.textMuted, fontFamily: F.mono, fontSize: 12, fontWeight: 500, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Get started →
              </Link>
            </div>
          </div>
        </div>

        {/* Honest note */}
        <div style={{ maxWidth: 720, marginTop: 40, padding: 24, background: C.surface, border: `1px solid ${C.border}` }}>
          <p style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Our commitment</p>
          <p style={{ fontSize: 13, color: C.textSub, lineHeight: 1.7 }}>
            Students will always have free access to Workmark — that is non-negotiable. For organizations, we may introduce paid tiers in the future as we scale, but we will give plenty of notice and grandfather early adopters. No surprise pricing changes, ever.
          </p>
        </div>
      </section>
    </MarketingLayout>
  )
}
