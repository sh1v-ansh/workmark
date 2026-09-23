import type { Metadata } from 'next'
import MarketplaceClient from './MarketplaceClient'

export const metadata: Metadata = {
  title: 'For businesses',
  description:
    'Post real work and see applicants arrive with a record built from code they actually shipped — every skill with the project behind it.',
}

export default function MarketplacePage() {
  return <MarketplaceClient />
}
