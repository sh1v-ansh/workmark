import type { Metadata } from 'next'
import { Playfair_Display, Inter, IBM_Plex_Mono, Schibsted_Grotesk, Hanken_Grotesk } from 'next/font/google'
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

// App faces. Schibsted carries headings and anything that needs to feel
// deliberate; Hanken carries everything else and is deliberately warmer and
// rounder than Inter.
const schibsted = Schibsted_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
})

const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
})


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
    <html lang="en" className={`${playfair.variable} ${inter.variable} ${plexMono.variable} ${schibsted.variable} ${hanken.variable}`}>
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
