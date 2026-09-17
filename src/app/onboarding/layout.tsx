import type { Metadata } from 'next'

/**
 * A layout for one metadata export.
 *
 * Onboarding is a client component, and a client component cannot export
 * metadata — so it inherited the site default and told anyone halfway through
 * setting up an account that they were on the home page. A layout is the way
 * Next gives a client page a title. See login/layout.tsx, which exists for
 * exactly the same reason.
 */
export const metadata: Metadata = {
  title: 'Setup',
}

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return children
}
