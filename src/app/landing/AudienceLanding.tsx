'use client'

import { useCallback, useEffect, useState } from 'react'
import { MarketingLayout } from './MarketingLayout'
import { MissionHero } from './MissionHero'
import { TheModes } from './TheModes'
import { TheLoop } from './TheLoop'
import { JoinSection } from './WaitlistSection'
import { AudienceProvider, AUDIENCE_ROUTES } from './audience-context'
import { HOME } from './audience'
import type { Audience } from './audience'

/**
 * The landing page, for whichever side is reading.
 *
 * LandingPage and MarketplaceClient were the same eight lines twice, differing
 * only in the initial audience — so a section added to one silently made the
 * two pages disagree. There is one composition now and the route supplies the
 * starting side.
 *
 * Switching audience rewrites the URL as well as the page. That is the whole
 * point: the toggle already moved every section, so leaving the address bar
 * on `/` while the page argued to businesses meant a reload, a bookmark or a
 * shared link all landed somewhere other than what the sender was looking at.
 *
 * `history.replaceState` rather than router.push, for two reasons. A push
 * would remount both routes' server components and throw away the scroll
 * position mid-page — CrossLink toggles from near the bottom, so that is a
 * real jump, not a theoretical one. And replace rather than push keeps the
 * back button pointed at wherever the reader came from instead of stacking
 * one history entry per flip of a switch.
 *
 * Nav does not depend on this working. It reads the audience from context,
 * so if the URL sync were ever a no-op the nav would still be correct.
 */
export function AudienceLanding({ initial }: { initial: Audience }) {
  const [audience, setAudience] = useState<Audience>(initial)

  const changeAudience = useCallback((next: Audience) => {
    setAudience(next)
    const url = AUDIENCE_ROUTES[next]
    if (typeof window !== 'undefined' && window.location.pathname !== url) {
      window.history.replaceState(null, '', url)
    }
  }, [])

  // /marketplace is the employer address. It shows the same page, opened at
  // the employer section, so an old link still lands on the right part.
  useEffect(() => {
    if (initial === 'businesses') document.getElementById('employers')?.scrollIntoView()
  }, [initial])

  return (
    <AudienceProvider value={{ audience, setAudience: changeAudience }}>
      <MarketingLayout>
        {/* One page for both readers: the hero, what each side gets, how it
            works for each, and a closing with a button for each. */}
        <MissionHero />
        <TheModes section={HOME.students} />
        <TheModes section={HOME.employers} />
        <TheLoop />
        <JoinSection />
      </MarketingLayout>
    </AudienceProvider>
  )
}
