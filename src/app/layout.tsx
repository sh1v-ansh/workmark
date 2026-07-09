import type { Metadata } from 'next'
import { Playfair_Display, Inter, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/components/Toast'

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
    <html lang="en" className={`${playfair.variable} ${inter.variable} ${plexMono.variable}`}>
      <body>
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
