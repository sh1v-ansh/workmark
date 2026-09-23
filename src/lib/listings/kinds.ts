/**
 * The kinds of posting on Find work, in the order the form offers them.
 * One list, so the form, the filter and the card badge never disagree.
 */
export const LISTING_KINDS = [
  { key: 'collaborative', label: 'Collaborative project', hint: 'Build something with other students.' },
  { key: 'startup', label: 'Student startup', hint: 'Find co-founders or early teammates.' },
  { key: 'paid', label: 'Paid role', hint: 'Paid work for a student.' },
  { key: 'research', label: 'Research or course project', hint: 'A lab, faculty or class project.' },
] as const

export type ListingKind = (typeof LISTING_KINDS)[number]['key']

export const KIND_LABEL: Record<ListingKind, string> = Object.fromEntries(
  LISTING_KINDS.map((k) => [k.key, k.label]),
) as Record<ListingKind, string>

export function isListingKind(value: unknown): value is ListingKind {
  return typeof value === 'string' && LISTING_KINDS.some((k) => k.key === value)
}
