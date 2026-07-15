'use client'

import { MarketingLayout } from './landing/MarketingLayout'
import { MissionHero } from './landing/MissionHero'
import { HiringProblem } from './landing/HiringProblem'
import { VerifiedRecords } from './landing/VerifiedRecords'
import { Capabilities } from './landing/Capabilities'
import { Roadmap } from './landing/Roadmap'
import { FounderNote } from './landing/FounderNote'
import { JoinSection } from './landing/WaitlistSection'

export default function LandingPage() {
  return (
    <MarketingLayout>
      <MissionHero />
      <HiringProblem />
      <VerifiedRecords />
      <Capabilities />
      <Roadmap />
      <FounderNote />
      <JoinSection />
    </MarketingLayout>
  )
}
