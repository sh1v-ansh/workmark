import type { Metadata } from 'next'
import { MarketingLayout } from '../landing/MarketingLayout'
import { HowItWorks } from '../landing/HowItWorks'
import { VerificationSection } from '../landing/VerificationSection'
import { JobMatching } from '../landing/JobMatching'
import { EngagementTypes } from '../landing/EngagementTypes'

export const metadata: Metadata = {
  title: 'How it works | Workmark',
  description: 'Learn how Workmark verifies CS student work through employer attestation, weekly check-ins, and permanent locked records.',
}

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
