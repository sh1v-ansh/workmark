'use client'

import { useState } from 'react'
import { MarketingLayout } from '../landing/MarketingLayout'
import { HowItWorks } from '../landing/HowItWorks'
import { JoinSection } from '../landing/WaitlistSection'
import type { Audience } from '../landing/audience'

/**
 * The client half of /how-it-works — the page itself stays a server
 * component so its metadata is still static, and only the audience state
 * lives down here.
 */
export default function HowItWorksPage() {
  const [audience, setAudience] = useState<Audience>('students')

  return (
    <MarketingLayout>
      <HowItWorks audience={audience} onAudienceChange={setAudience} />
      <JoinSection audience={audience} />
    </MarketingLayout>
  )
}
