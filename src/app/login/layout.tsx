import type { Metadata } from 'next'

/**
 * A layout for one metadata export.
 *
 * The login page is a client component, and a client component cannot export
 * metadata — so /login was inheriting the site default and telling anyone who
 * arrived from a link that they were on the home page. A layout is the way
 * Next gives a client page a title.
 */
export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to Workmark, or create a student account with your .edu address.',
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
