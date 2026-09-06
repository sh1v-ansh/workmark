'use client'

import { useState } from 'react'
import { MarketingLayout } from '../landing/MarketingLayout'
import { MissionHero } from '../landing/MissionHero'
import { TheRecord } from '../landing/TheRecord'
import { TheLoop } from '../landing/TheLoop'
import { CrossLink } from '../landing/CrossLink'
import { JoinSection } from '../landing/WaitlistSection'
import type { Audience } from '../landing/audience'

/**
 * /marketplace, which is the home page opened on the other side.
 *
 * It used to be six components of its own — TheProblem, TheStat, WhoItFor,
 * EngagementTypes, VerificationSection, JobMatching — all describing the
 * poster-attestation flow in the pre-refresh design, and all of it a second
 * copy of an argument the home page was already making differently. Two
 * pages saying overlapping things about one product is how they drift.
 *
 * So this is the same page with the switch pre-set to businesses. The URL
 * keeps working, the nav link keeps meaning something, and there is one
 * story to maintain instead of two.
 */
export default function MarketplaceClient() {
  const [audience, setAudience] = useState<Audience>('businesses')

  return (
    <MarketingLayout>
      <MissionHero audience={audience} onAudienceChange={setAudience} />
      <TheRecord audience={audience} />
      <TheLoop audience={audience} />
      <CrossLink audience={audience} onAudienceChange={setAudience} />
      <JoinSection audience={audience} />
    </MarketingLayout>
  )
}
