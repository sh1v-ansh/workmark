// Deterministic color-hash for skill/tag chips — a fixed string always maps
// to the same hue, so "React" is always the same color everywhere it shows
// up, without a lookup table to maintain per-skill.

const PALETTE = [
  { bg: '#EEF2FF', border: '#C7D2FE', text: '#3730A3' }, // indigo
  { bg: '#F0FDF4', border: '#BBF7D0', text: '#15803D' }, // green
  { bg: '#FFF7ED', border: '#FED7AA', text: '#9A3412' }, // orange
  { bg: '#FDF2F8', border: '#FBCFE8', text: '#9D174D' }, // pink
  { bg: '#ECFEFF', border: '#A5F3FC', text: '#155E75' }, // cyan
  { bg: '#FEFCE8', border: '#FEF08A', text: '#854D0E' }, // amber
  { bg: '#F5F3FF', border: '#DDD6FE', text: '#5B21B6' }, // violet
  { bg: '#F0F9FF', border: '#BAE6FD', text: '#0369A1' }, // sky
] as const

export type TagColor = (typeof PALETTE)[number]

export function tagColor(label: string): TagColor {
  let hash = 0
  for (let i = 0; i < label.length; i++) {
    hash = (hash * 31 + label.charCodeAt(i)) | 0
  }
  const idx = Math.abs(hash) % PALETTE.length
  return PALETTE[idx]
}
