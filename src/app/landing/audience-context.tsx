'use client'

import { createContext, useContext } from 'react'
import type { Audience } from './audience'

/**
 * Which URL each audience belongs to.
 *
 * `/` and `/marketplace` are not two pages. They are one page opened on
 * different sides — LandingPage and MarketplaceClient render exactly the
 * same six sections and differ only in which audience they start on. That
 * is a reasonable thing to have built, and it is why the nav was lying:
 * "Mission" and "Marketplace" described two destinations that do not exist,
 * and flipping the toggle moved the whole page while the nav kept insisting
 * you were still where you started.
 *
 * So the route is a fact about the audience, and this map is the one place
 * that relationship is written down.
 */
export const AUDIENCE_ROUTES: Record<Audience, string> = {
  students: '/',
  businesses: '/marketplace',
}

/** The reverse lookup, for asking "is this href an audience?" */
export const ROUTE_AUDIENCES: Record<string, Audience> = {
  '/': 'students',
  '/marketplace': 'businesses',
}

export interface AudienceNav {
  audience: Audience
  setAudience: (next: Audience) => void
}

/**
 * Null on every marketing page that is not the two-sided landing page.
 *
 * /about, /how-it-works and /pricing render the same MarketingLayout and
 * therefore the same Nav, but they have no audience to be on. Null is the
 * signal for Nav to fall back to plain pathname matching rather than
 * inventing an audience those pages do not have.
 */
const AudienceContext = createContext<AudienceNav | null>(null)

export function AudienceProvider({
  value,
  children,
}: {
  value: AudienceNav
  children: React.ReactNode
}) {
  return <AudienceContext.Provider value={value}>{children}</AudienceContext.Provider>
}

export function useAudienceNav(): AudienceNav | null {
  return useContext(AudienceContext)
}
