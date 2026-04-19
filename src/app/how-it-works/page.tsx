'use client'

import { MarketingLayout } from '../landing/MarketingLayout'
import { HowItWorks } from '../landing/HowItWorks'
import { VerificationSection } from '../landing/VerificationSection'
import { JobMatching } from '../landing/JobMatching'
import { EngagementTypes } from '../landing/EngagementTypes'

export default function HowItWorksPage() {
  return (
    <MarketingLayout>
      <HowItWorks />
      <VerificationSection />
      <JobMatching />
      <EngagementTypes />
    </MarketingLayout>
  )
}
