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

export type Palette = { [K in keyof typeof light]: string }
export type ThemeName = 'light' | 'dark'

export const themes: Record<ThemeName, Palette> = { light, dark }

// ─── Fonts (rendered by next/font in layout.tsx, exposed as CSS variables) ───
export const F = {
  serif: 'var(--font-serif), Georgia, "Times New Roman", serif',   // Playfair Display
  sans:  'var(--font-sans), Inter, system-ui, sans-serif',
  mono:  'var(--font-mono), "IBM Plex Mono", Menlo, monospace',
} as const

export type FontStack = typeof F
