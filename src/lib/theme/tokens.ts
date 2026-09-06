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

// ─── App theme — "Lit edges" ─────────────────────────────────────────────────
// The logged-in product. White ground, cool greys, and violet reserved for
// things you can act on.
//
// This replaced a warm cream paper. The paper was pleasant on its own and
// wrong in company: it pushed every card towards beige, it made the violet
// look muddy, and there is no version of "verified" that reads as valuable
// against it. The ground is now white and the depth comes from two things
// the paper could not give — very soft radial light (ART.page) and shadow.
//
// Token NAMES match `light` exactly. That is deliberate: ~900 inline styles
// across the app read C.text / C.surface / C.border, so repointing the export
// in dark-tokens.ts re-themes every page without editing a single call site.
// Values below are the only thing that differs.
//
// Contrast verified against white, which is what the app renders on.
export const app = {
  bg:            '#FFFFFF',      // the ground; ART.page lights its corners
  bgAlt:         '#FBFBFD',      // the next surface down — a hair cooler, not grey
  bgDeep:        '#191E2E',      // reversed panel — the one dark block per page
  surface:       '#FFFFFF',      // cards sit above the ground on shadow, not tint
  surfaceAlt:    '#F7F7FA',      // a panel nested inside a card
  border:        '#ECEBF3',
  borderFaint:   '#F4F3F8',
  text:          '#191E2E',      // 15.4:1 on white
  textSub:       '#2B3244',      // 12.2:1
  textMuted:     '#5A6172',      // 6.0:1
  textFaint:     '#666D80',      // 5.0:1 — still passes at body sizes
  textGhost:     '#8D94A5',      // 3.6:1 — large text only
  accent:        '#6142F5',      // 5.6:1 on white
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
  neutralBg:    '#F2F2F7',
} as const

// ─── Skill levels ────────────────────────────────────────────────────────────
// Three levels, and only the top one is coloured.
//
// Gold marks a skill the scan could actually prove out. It works because it
// is scarce — on a typical record six of thirty-seven skills carry it. Apply
// it to a whole list and it stops meaning anything, so LEVELS.advanced must
// never be used for "a skill", only for "an advanced skill".
//
// The fill is a gradient rather than a flat yellow on purpose: flat gold is
// the colour of a novelty sticker, a gradient is the colour of a medal.
//
// Gold is never a button. Nothing gold is clickable.
export const LEVELS = {
  advanced: {
    fill:   'linear-gradient(145deg, #F9E4AE 0%, #EBCB74 44%, #D9A93C 100%)',
    border: '#CE9F32',
    text:   '#4A3106',      // 8.9:1 on the lightest stop
    sub:    '#7A5410',      // the "Advanced" suffix, quieter than the name
    bar:    'linear-gradient(90deg, #EBCB74 0%, #D9A93C 100%)',
    shadow: '0 1px 2px rgba(154,113,18,0.20), 0 5px 12px -6px rgba(184,141,40,0.50)',
  },
  intermediate: {
    fill:   '#F4F4F7',
    border: '#E6E6EE',
    text:   '#3A4152',
    sub:    '#8D94A5',
    bar:    '#B9BDCA',
    shadow: 'none',
  },
  beginner: {
    fill:   '#F4F4F7',
    border: '#E6E6EE',
    text:   '#3A4152',
    sub:    '#8D94A5',
    bar:    '#E4E4EB',
    shadow: 'none',
  },
} as const

export type SkillLevel = keyof typeof LEVELS

// ─── Scales ──────────────────────────────────────────────────────────────────
// One source for the numbers that used to be typed by hand at every call site.

/** Corner radii. The app has three, not eleven. */
export const R = {
  sm: 8,    // chips, badges, small inputs
  md: 9,    // buttons, rows nested inside a card
  lg: 13,   // cards, panels
  pill: 999,
} as const

/** Type sizes. Display sizes use F.display; the rest use F.sans.
 *  Trimmed once, deliberately, after the composed pages shipped too large —
 *  keep new sizes inside this scale rather than reaching for a raw px value. */
export const T = {
  display: 32,  // page title
  h1: 26,
  h2: 19.5,       // section heading inside a card
  h3: 16.5,       // row title
  body: 15,
  bodySm: 13.5, // secondary line under a row title
  meta: 12.5,   // timestamps, counts, attribution
  label: 11.5,    // uppercase tab/eyebrow labels
} as const

/** Elevation.
 *
 *  On the old cream paper a card was legible because it was white and the
 *  page was not, so a border was enough. On a white ground that trick is
 *  gone: a white card on white needs light under it. `card` is the default
 *  for anything that used to be `E.none` plus a border; `focal` is for the
 *  one card per screen you want read first, and paying twice on the same
 *  screen spends the effect. */
export const E = {
  none: 'none',
  card:    '0 1px 1px rgba(25,30,46,0.03), 0 8px 20px -12px rgba(25,30,46,0.18)',
  focal:   '0 1px 2px rgba(97,66,245,0.06), 0 16px 36px -20px rgba(97,66,245,0.45)',
  button:  '0 1px 2px rgba(97,66,245,0.24), 0 8px 18px -8px rgba(97,66,245,0.55)',
  overlay: '0 4px 6px rgba(25,30,46,0.04), 0 12px 32px rgba(25,30,46,0.10)',
} as const

/** Background art.
 *
 *  Two very soft violet radials in the top corners. They carry no meaning and
 *  must never be the reason something is findable — they exist so a white
 *  page has a top and a bottom. `focal` pools a little more light into the
 *  bottom-right of the card that owns the screen. */
export const ART = {
  page:
    'radial-gradient(900px 420px at 12% -8%, rgba(97,66,245,0.07) 0%, rgba(97,66,245,0) 68%), ' +
    'radial-gradient(700px 380px at 96% 2%, rgba(129,140,248,0.06) 0%, rgba(129,140,248,0) 70%)',
  focal:
    'radial-gradient(560px 260px at 88% 108%, rgba(97,66,245,0.10) 0%, rgba(97,66,245,0) 72%)',
} as const

/** The border a focal card uses instead of C.border. */
export const FOCAL_BORDER = '#DCD4F7'

// ─── App font stacks ─────────────────────────────────────────────────────────
// Exported separately from F so the marketing pages keep Playfair/Inter/Plex
// while the app runs on Instrument Sans.
//
// All four keys resolve to the same family, which is the point. The app used
// to pair a display face with a body face; readers did not notice the pairing
// and the payload was twice what it needed to be. The keys survive only so
// the ~900 call sites reading F.display / F.sans / F.mono keep compiling —
// they are aliases now, not choices, and new code should just use F.sans.
//
// `mono` is deliberately NOT monospace. Around 200 call sites set it on
// timestamps and counts, which is what made the app read as a terminal
// rather than a product.
const APP_STACK = 'var(--font-app), "Instrument Sans", system-ui, sans-serif'

export const appFonts = {
  display: APP_STACK,
  sans:    APP_STACK,
  serif:   APP_STACK,
  mono:    APP_STACK,
} as const

// ─── Fonts (rendered by next/font in layout.tsx, exposed as CSS variables) ───
export const F = {
  serif: 'var(--font-serif), Georgia, "Times New Roman", serif',   // Playfair Display
  sans:  'var(--font-sans), Inter, system-ui, sans-serif',
  mono:  'var(--font-mono), "IBM Plex Mono", Menlo, monospace',
} as const

export type FontStack = typeof F
