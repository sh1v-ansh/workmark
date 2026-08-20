import type { BadgeTone } from '@/components/ui/Badge'
import type { FitTier } from '@/lib/matching/fit'

/** One mapping, used everywhere a fit tier becomes a Badge. */
export const FIT_TIER_TONE: Record<FitTier, BadgeTone> = {
  strong_fit: 'positive',
  competitive: 'info',
  reach: 'caution',
  not_yet: 'neutral',
}
