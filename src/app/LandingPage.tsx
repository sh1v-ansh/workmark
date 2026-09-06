'use client'

import { useState } from 'react'
import { MarketingLayout } from './landing/MarketingLayout'
import { MissionHero } from './landing/MissionHero'
import { TheRecord } from './landing/TheRecord'
import { TheLoop } from './landing/TheLoop'
import { TheExternship } from './landing/TheExternship'
import { CrossLink } from './landing/CrossLink'
import { JoinSection } from './landing/WaitlistSection'
import type { Audience } from './landing/audience'

/**
 * One page, two stories.
 *
 * The audience lives here rather than in each section, because the switch in
 * the hero has to move the whole page — a toggle that changed the headline
 * and left three sections talking to the other reader would be worse than no
 * toggle at all.
 *
 * Students are the default. They are the side that has to exist first: a
 * project board with nobody on it is worth nothing to a business, while a
 * record is worth something to a student on their first day.
 */
export default function LandingPage() {
  const [audience, setAudience] = useState<Audience>('students')

  return (
    <MarketingLayout>
      <MissionHero audience={audience} onAudienceChange={setAudience} />
      <TheRecord audience={audience} />
      <TheLoop audience={audience} />
      <TheExternship audience={audience} />
      <CrossLink audience={audience} onAudienceChange={setAudience} />
      <JoinSection audience={audience} />
    </MarketingLayout>
  )
}
