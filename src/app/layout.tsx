import type { Metadata } from 'next'
import { Playfair_Display, Inter, IBM_Plex_Mono, Schibsted_Grotesk, Hanken_Grotesk, Caveat } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/components/Toast'

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

// Handwriting. Loaded for a reason but rationed hard — see .wm-hand in
// globals.css for where it is and is not allowed.
const caveat = Caveat({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-hand',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Workmark — Verified Hiring Infrastructure for CS Talent',
  description:
    'A marketplace that connects CS students to real projects at SMBs, startups, and nonprofits. Every completed engagement generates a verified, employer-attested work record.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable} ${plexMono.variable} ${schibsted.variable} ${hanken.variable} ${caveat.variable}`}>
      <body>
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
