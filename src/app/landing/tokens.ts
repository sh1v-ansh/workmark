// Landing / marketing surfaces use the light theme.
// See `src/lib/theme/tokens.ts` for the canonical definitions.
export { light as C } from '@/lib/theme/tokens'

// One typeface across the whole site, matching the product.
//
// The landing page ran on Playfair Display for headings and Inter for body,
// while the app runs on Instrument Sans. That is two brands, and anyone
// crossing from the hero into signup — which is the one journey this page
// exists to produce — watched the identity change under them.
//
// The keys are unchanged and all three resolve to the same family, so every
// existing F.serif / F.sans / F.mono call site switches without being
// touched. New code should just use F.sans.
const MARKETING_STACK = 'var(--font-app), "Instrument Sans", system-ui, sans-serif'

export const F = {
  serif: MARKETING_STACK,
  sans:  MARKETING_STACK,
  mono:  MARKETING_STACK,
} as const
