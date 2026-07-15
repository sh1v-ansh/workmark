'use client'

import Link from 'next/link'
import { MarketingLayout } from '../landing/MarketingLayout'
import { TheProblem } from '../landing/TheProblem'
import { TheStat } from '../landing/TheStat'
import { WhoItFor } from '../landing/WhoItFor'
import { HowItWorks } from '../landing/HowItWorks'
import { EngagementTypes } from '../landing/EngagementTypes'
import { VerificationSection } from '../landing/VerificationSection'
import { JobMatching } from '../landing/JobMatching'
import { JoinSection } from '../landing/WaitlistSection'
import { C, F } from '../landing/tokens'

export default function MarketplacePage() {
  return (
    <MarketingLayout>
      {/* Marketplace intro */}
      <section style={{ padding: '120px 24px 64px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ maxWidth: 780 }}>
          <div className="wm-eyebrow" style={{ marginBottom: 22 }}>The Workmark marketplace</div>
          <h1 className="mob-text-hero" style={{ fontFamily: F.serif, fontSize: 60, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.035em', color: C.text, margin: '0 0 22px' }}>
            Where verified work records get earned.
          </h1>
          <p style={{ fontSize: 19, lineHeight: 1.65, color: C.textMuted, maxWidth: 640, marginBottom: 36 }}>
            Students take on real projects and internships — for other student teams today, and
            for SMBs, startups, and nonprofits as we grow. Every engagement ends the same way:
            a permanent, poster-attested Workmark record.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/projects" className="wm-btn wm-btn-primary">
              Browse open projects →
            </Link>
            <Link href="/login" className="wm-btn wm-btn-secondary">
              Post a project
            </Link>
          </div>
        </div>
      </section>

      <TheProblem />
      <TheStat />
      <HowItWorks />
      <EngagementTypes />
      <WhoItFor />
      <VerificationSection />
      <JobMatching />
      <JoinSection />
    </MarketingLayout>
  )
}
