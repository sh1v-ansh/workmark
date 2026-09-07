import type { Metadata } from 'next'
import HowItWorksPage from './HowItWorksPage'

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'How Workmark turns the code you have already written into a skill record an employer can check, and what it reads to do it.',
}

export default function Page() {
  return <HowItWorksPage />
}
