'use client'

import { MarketingLayout } from './landing/MarketingLayout'
import { MissionHero } from './landing/MissionHero'
import { TheRecord } from './landing/TheRecord'
import { TheLoop } from './landing/TheLoop'
import { ForPosters } from './landing/ForPosters'
import { JoinSection } from './landing/WaitlistSection'

/**
 * Five sections, down from six, and every one about something that exists.
 *
 * What came out: HiringProblem, three borrowed statistics arguing that
 * hiring is broken — replaced by TheRecord, which shows the thing instead.
 * Capabilities and Roadmap, both of which described what was coming on a
 * page whose job is to earn enough trust for someone to connect their
 * GitHub; the one genuinely forward-looking thing left is step four of
 * TheLoop, and it is labelled.
 */
export default function LandingPage() {
  return (
    <MarketingLayout>
      <MissionHero />
      <TheRecord />
      <TheLoop />
      <ForPosters />
      <JoinSection />
    </MarketingLayout>
  )
}
