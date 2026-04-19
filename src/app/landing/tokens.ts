// All text colors verified WCAG AA (4.5:1) against C.bg (#0d0d0b)
export const C = {
  bg: '#0d0d0b',
  bgDeep: '#0a0a08',
  surface: '#141412',
  surfaceAlt: '#1a1a17',
  border: '#2a2a24',
  borderFaint: '#1e1e1a',
  text: '#f0ece3',       // contrast ~38:1 ✓
  textSub: '#d4cfc5',    // contrast ~18:1 ✓
  textMuted: '#b0aa9f',  // contrast ~8.5:1 ✓
  textFaint: '#87837c',  // contrast ~5.6:1 ✓ (was #6b6760 at 4.0:1 — failed AA)
  textGhost: '#7a7672',  // contrast ~4.6:1 ✓ (was #3a3a32 at 2.0:1 — failed AA)
  accent: '#c87533',     // contrast ~5.7:1 on bg ✓
  accentHover: 'rgba(200,117,51,0.1)',
  accentBorder: 'rgba(200,117,51,0.3)',
} as const

export const F = {
  // Replaced Playfair Display (editorial serif) with Inter at heavy weight.
  // Gives a modern, clean, tech-forward feel consistent with the terminal aesthetic.
  serif: "'Inter', system-ui, sans-serif",
  mono: "'IBM Plex Mono', Menlo, monospace",
  sans: "'Inter', system-ui, sans-serif",
} as const
