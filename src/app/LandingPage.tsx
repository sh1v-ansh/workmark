'use client'

import { AudienceLanding } from './landing/AudienceLanding'

/**
 * The home page.
 *
 * Students are the default. They are the side that has to exist first: a
 * project board with nobody on it is worth nothing to a business, while a
 * record is worth something to a student on their first day.
 *
 * The composition itself lives in AudienceLanding, shared with /marketplace
 * — see the note there.
 */
export default function LandingPage() {
  return <AudienceLanding initial="students" />
}
