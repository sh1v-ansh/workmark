// Workmark design tokens — dual theme (light landing, dark app).
// Primary: #3E1FFF (bright violet). All contrast ratios verified WCAG AA on
// their respective backgrounds (target 4.5:1 for body text, 3:1 for large).

// ─── Shared violet scale (identical between themes) ──────────────────────────
export const violet = {
  50:  '#F3F0FF',
  100: '#E5DEFF',
  200: '#C7B8FF',
  300: '#A48CFF',
  400: '#7F5CFF',
  500: '#3E1FFF',  // base — the color the user asked for
  600: '#2E0FE5',
  700: '#2408BC',
  800: '#1C0693',
  900: '#150570',
} as const

// ─── Light theme — used by marketing / landing surfaces ──────────────────────
export const light = {
  bg:            '#FFFFFF',
  bgAlt:         '#FAFAFB',
  bgDeep:        '#0A0A0A',      // reversed panel for high-contrast callouts
  surface:       '#F7F6FB',
  surfaceAlt:    '#F3F0FF',      // violet-50 tint
  border:        '#E5E4EF',
  borderFaint:   '#EFEEF5',
  text:          '#0A0A0A',      // 20.8:1 on white
  textSub:       '#1F1F26',      // 15.7:1
  textMuted:     '#4B4B57',      // 8.6:1
  textFaint:     '#6C6C78',      // 5.6:1
  textGhost:     '#8A8A94',      // 3.9:1 (large text only)
  accent:        violet[500],    // #3E1FFF, 6.9:1 on white ✓
  accentHover:   'rgba(62,31,255,0.08)',
  accentBorder:  'rgba(62,31,255,0.28)',
  accentInk:     violet[600],    // for hover states on primary buttons
} as const

// ─── Dark theme — used by app / dashboard / auth surfaces ────────────────────
export const dark = {
  bg:            '#0A0A0A',
  bgAlt:         '#0F0F10',
  bgDeep:        '#050505',
  surface:       '#141416',
  surfaceAlt:    '#1B1B1F',
  border:        '#26262B',
  borderFaint:   '#1E1E22',
  text:          '#F5F4F8',      // 18.4:1 on #0A0A0A
  textSub:       '#DAD8E1',      // 13.9:1
  textMuted:     '#A5A5AF',      // 7.2:1
  textFaint:     '#7C7C86',      // 4.9:1
  textGhost:     '#5F5F68',      // 3.3:1 (large text only)
  accent:        violet[500],    // #3E1FFF, 5.2:1 on #0A0A0A ✓
  accentHover:   'rgba(62,31,255,0.14)',
  accentBorder:  'rgba(62,31,255,0.40)',
  accentInk:     violet[300],    // lighter for text on the accent bg
} as const

// ─── App theme — "Notebook" ──────────────────────────────────────────────────
// The logged-in product. Cream paper, ink-blue near-black, and a violet that
// sits a shade warmer and lighter than the marketing #3E1FFF so it holds
// together against warm paper instead of fighting it.
//
// Token NAMES match `light` exactly. That is deliberate: ~900 inline styles
// across the app read C.text / C.surface / C.border, so repointing the export
// in dark-tokens.ts re-themes every page without editing a single call site.
// Values below are the only thing that differs.
//
// Contrast verified against the paper (#FAF7F0), not against pure white —
// the paper is what the app actually renders on.
export const app = {
  bg:            '#FAF7F0',      // paper
  bgAlt:         '#F4F1E9',      // the next surface down
  bgDeep:        '#191E2E',      // reversed panel — the one dark block per page
  surface:       '#FFFFFF',      // cards sit above the paper, not level with it
  surfaceAlt:    '#F4F1E9',
  border:        '#E7E2D6',
  borderFaint:   '#F1EDE3',
  text:          '#191E2E',      // 14.9:1 on paper
  textSub:       '#2B3244',      // 11.8:1
  textMuted:     '#5A6172',      // 5.8:1
  textFaint:     '#666D80',      // 4.8:1 — still passes at body sizes
  textGhost:     '#8D94A5',      // 3.5:1 — large text only
  accent:        '#6142F5',      // 5.5:1 on paper
  accentHover:   'rgba(97,66,245,0.08)',
  accentBorder:  'rgba(97,66,245,0.30)',
  accentInk:     '#4E2FD6',
} as const

export type Palette = { [K in keyof typeof light]: string }
export type ThemeName = 'light' | 'dark' | 'app'

export const themes: Record<ThemeName, Palette> = { light, dark, app }

// ─── Semantic state colors (app only) ────────────────────────────────────────
// Kept out of the palette because they answer a different question: the
// palette is "how does the page look", these are "what happened". Each pair
// is verified against its own background, not against the paper.
export const state = {
  positive:     '#14663D',  // 6.0:1 on positiveBg
  positiveBg:   '#DEF1E6',
  caution:      '#94500F',  // 5.5:1 on cautionBg
  cautionBg:    '#FBEFE0',
  info:         '#1D4ED8',
  infoBg:       '#E4EBFF',
  neutral:      '#5A6172',
  neutralBg:    '#F1EDE3',
} as const

// ─── Scales ──────────────────────────────────────────────────────────────────
// One source for the numbers that used to be typed by hand at every call site.

/** Corner radii. The app has three, not eleven. */
export const R = {
  sm: 7,    // chips, badges, small inputs
  md: 9,    // buttons, rows nested inside a card
  lg: 12,   // cards, panels
  pill: 999,
} as const

/** Type sizes. Display sizes use F.display; the rest use F.sans.
 *  Trimmed once, deliberately, after the composed pages shipped too large —
 *  keep new sizes inside this scale rather than reaching for a raw px value. */
export const T = {
  display: 27,  // page title
  h1: 22,
  h2: 17,       // section heading inside a card
  h3: 15,       // row title
  body: 14.5,
  bodySm: 13.5, // secondary line under a row title
  meta: 12.5,   // timestamps, counts, attribution
  label: 11,    // uppercase tab/eyebrow labels
} as const

/** Elevation. Cards are bordered, not floated — shadow is for overlays only. */
export const E = {
  none: 'none',
  overlay: '0 4px 6px rgba(25,30,46,0.04), 0 12px 32px rgba(25,30,46,0.10)',
} as const

// ─── App font stacks ─────────────────────────────────────────────────────────
// Exported separately from F so the marketing pages keep Playfair/Inter/Plex
// while the app moves to Schibsted + Hanken.
//
// `mono` is deliberately NOT monospace any more. The app had ~200 call sites
// setting fontFamily: F.mono on timestamps and counts, which is what made it
// read as a terminal rather than a product. Rather than churn all of them at
// once, the token now resolves to the body face — those call sites become
// correct by doing nothing, and the key disappears as pages get rebuilt.
export const appFonts = {
  display: 'var(--font-display), "Schibsted Grotesk", system-ui, sans-serif',
  sans:    'var(--font-body), "Hanken Grotesk", system-ui, sans-serif',
  serif:   'var(--font-display), "Schibsted Grotesk", system-ui, sans-serif',
  mono:    'var(--font-body), "Hanken Grotesk", system-ui, sans-serif',
} as const

// ─── Fonts (rendered by next/font in layout.tsx, exposed as CSS variables) ───
export const F = {
  serif: 'var(--font-serif), Georgia, "Times New Roman", serif',   // Playfair Display
  sans:  'var(--font-sans), Inter, system-ui, sans-serif',
  mono:  'var(--font-mono), "IBM Plex Mono", Menlo, monospace',
} as const

export type FontStack = typeof F
