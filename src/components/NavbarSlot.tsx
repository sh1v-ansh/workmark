'use client'

import Navbar from '@/components/Navbar'
import { useSession } from '@/components/SessionProvider'

/**
 * The navbar, for places that don't know who's signed in.
 *
 * `loading.tsx` files are the reason this exists. The navbar is rendered
 * inside each page rather than in a layout, so when Next swaps a page for
 * its loading fallback the navbar goes with it — the nav visibly disappears
 * the moment you click a nav link, which is the worst possible time.
 *
 * Putting the navbar in the fallback keeps it on screen across that swap.
 * It reads everything it needs from the session context in the root layout,
 * which sits above the loading boundary, so no page has to pass anything.
 *
 * Signed-out visitors get nothing: /listings renders publicly, and a nav
 * full of "My record" links is worse than no nav for someone with no account.
 */
export default function NavbarSlot() {
  const { signedIn } = useSession()
  if (!signedIn) return null
  return <Navbar />
}
