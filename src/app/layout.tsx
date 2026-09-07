import type { Metadata } from 'next'
import { Playfair_Display, Inter, IBM_Plex_Mono, Instrument_Sans } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/components/Toast'
import { CookieNotice } from '@/components/CookieNotice'
import { SessionProvider, type SessionValue } from '@/components/SessionProvider'
import { createClient } from '@/lib/supabase/server'
import { getAccount, hasRole, isVerifiedFaculty } from '@/lib/auth/roles'

// Marketing faces. The landing pages keep the identity they were designed
// with; only the logged-in app moves to the new one below.
const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-serif',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

// App face. One family for the whole product, not two.
//
// Schibsted-for-headings + Hanken-for-body was a pairing decision that never
// paid for itself: the two faces are close enough that nobody reads them as
// different voices, and it doubled the font payload on every page. Instrument
// Sans carries both jobs, and headings drop to 600 rather than 700 — the old
// pairing read heavy, and one weight step is most of that fix.
const instrument = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-app',
  display: 'swap',
})

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://www.workmark.org'

/**
 * The defaults every page inherits.
 *
 * There was nothing here before, which meant the home page — the one a
 * stranger actually lands on — had no title and no description at all, and
 * a pasted link rendered as a bare grey box. Ten pages set their own title
 * and each picked its own brand separator (·, —, |), so the site read as
 * three different sites depending on which tab you were looking at.
 *
 * `template` fixes that for good: pages now set only their own name and the
 * suffix is appended here, in one place. A page that genuinely wants no
 * suffix says so with `title: { absolute: '…' }`.
 *
 * `metadataBase` is what makes the relative OG image path below resolve to
 * an absolute URL. Without it Next warns and social cards silently fall
 * back to no image, which is the failure mode this block exists to prevent.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: 'Workmark — proof of what you can build',
    template: '%s · Workmark',
  },
  description:
    'Workmark reads the code you actually wrote and turns it into a skill record an employer can check. Free for students with a .edu address.',
  applicationName: 'Workmark',
  openGraph: {
    type: 'website',
    siteName: 'Workmark',
    url: SITE,
    title: 'Workmark — proof of what you can build',
    description:
      'You need experience to get experience. Workmark hands you the projects instead, then turns what you build into proof an employer can check.',
    images: ['/opengraph-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Workmark — proof of what you can build',
    description:
      'You need experience to get experience. Workmark hands you the projects instead, then turns what you build into proof an employer can check.',
    images: ['/opengraph-image.png'],
  },
}


/**
 * Read once here rather than per page.
 *
 * The previous approach passed the account down as a prop, and only two of
 * the fourteen pages that render the navbar remembered to pass it — so an
 * admin was correctly granted the role and saw no evidence of it anywhere.
 * One read at the root can't be forgotten by the next page someone adds.
 */
async function loadSession(): Promise<SessionValue> {
  try {
    const supabase = await createClient()
    const account = await getAccount(supabase)
    if (!account) return { signedIn: false, roles: [], isAdmin: false, isFaculty: false, isVerifiedFaculty: false, displayName: null }

    // The account row carries the name for everyone. The student profile is
    // only a fallback, for accounts created before the name moved — and
    // faculty have no student profile to fall back to at all.
    const { data: named } = await supabase
      .from('accounts')
      .select('display_name')
      .eq('id', account.id)
      .maybeSingle()

    let displayName = named?.display_name ?? null

    if (!displayName) {
      const { data: profile } = await supabase
        .from('students')
        .select('full_name')
        .eq('id', account.id)
        .maybeSingle()
      displayName = profile?.full_name ?? null
    }

    return {
      signedIn: true,
      roles: account.roles,
      isAdmin: hasRole(account, 'admin'),
      isFaculty: hasRole(account, 'faculty'),
      isVerifiedFaculty: isVerifiedFaculty(account),
      displayName,
    }
  } catch {
    // The layout wraps every page including the marketing site. A failed
    // session read must render a signed-out shell, never a blank site.
    return { signedIn: false, roles: [], isAdmin: false, isFaculty: false, isVerifiedFaculty: false, displayName: null }
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await loadSession()
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable} ${plexMono.variable} ${instrument.variable}`}>
      <body>
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        <SessionProvider value={session}>
          <ToastProvider>{children}</ToastProvider>
        </SessionProvider>
        <CookieNotice />
      </body>
    </html>
  )
}
