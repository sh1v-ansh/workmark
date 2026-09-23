import type { Metadata } from 'next'
import ResetClient from './ResetClient'

export const metadata: Metadata = {
  title: 'Reset',
  // Nobody should arrive here from a search result, and a recovery URL in an
  // index is a URL in somebody's referrer log.
  robots: { index: false, follow: false },
}

export default function ResetPasswordPage() {
  return <ResetClient />
}
