import type { Metadata } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/Toast'

export const metadata: Metadata = {
  title: 'Workmark — Verified CS Internship & Project Marketplace',
  description:
    'Apply to company projects and earn verified experience records. The credibility layer for your CS career.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {/* Skip-to-content — WCAG 2.4.1 bypass block */}
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
