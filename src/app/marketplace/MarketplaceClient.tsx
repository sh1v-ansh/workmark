'use client'

import { AudienceLanding } from '../landing/AudienceLanding'

/**
 * /marketplace, which is the home page opened on the other side.
 *
 * It used to be six components of its own — TheProblem, TheStat, WhoItFor,
 * EngagementTypes, VerificationSection, JobMatching — all describing the
 * poster-attestation flow in the pre-refresh design, and all of it a second
 * copy of an argument the home page was already making differently. Two
 * pages saying overlapping things about one product is how they drift.
 *
 * So this is the same page with the switch pre-set to businesses, and the
 * nav link that points here now says "For businesses" rather than
 * "Marketplace" — the actual marketplace is /listings, and a nav that
 * promised a board and delivered a pitch was the reason this page looked
 * like a duplicate of the home page rather than the other half of it.
 */
export default function MarketplaceClient() {
  return <AudienceLanding initial="businesses" />
}
