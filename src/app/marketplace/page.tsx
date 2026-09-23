import type { Metadata } from 'next'
import MarketplaceClient from './MarketplaceClient'

export const metadata: Metadata = {
  title: 'For employers',
  description:
    'Screen candidates by verified work before OAs and interviews. See deployed projects, per-skill levels and supervised work records from students who are open to work.',
}

export default function MarketplacePage() {
  return <MarketplaceClient />
}
