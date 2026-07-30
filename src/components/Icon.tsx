// Small inline stroke-icon set — zero external dependency, matches the
// hairline/geometric feel of the rest of the product instead of relying on
// unicode glyphs (✓ → ▼ ↗) as pseudo-icons.

export type IconName =
  | 'check' | 'arrow-right' | 'chevron-down' | 'chevron-up' | 'external-link'
  | 'mail' | 'github' | 'linkedin' | 'clock' | 'users' | 'star' | 'map-pin'
  | 'search' | 'x' | 'plus' | 'message' | 'eye' | 'briefcase' | 'award'
  | 'refresh' | 'edit' | 'calendar' | 'link' | 'inbox'

const PATHS: Record<IconName, React.ReactNode> = {
  check: <path d="M3 9.5l4 4 8-9" />,
  'arrow-right': <path d="M3 9h12M10 4l5 5-5 5" />,
  'chevron-down': <path d="M4 6.5l5 5 5-5" />,
  'chevron-up': <path d="M4 11.5l5-5 5 5" />,
  'external-link': (
    <>
      <path d="M7 4H4.5A1.5 1.5 0 003 5.5v8A1.5 1.5 0 004.5 15h8a1.5 1.5 0 001.5-1.5V11" />
      <path d="M9.5 3H15v5.5M15 3L8 10" />
    </>
  ),
  mail: (
    <>
      <rect x="2.5" y="4" width="13" height="10" rx="1.5" />
      <path d="M3 5l6 5 6-5" />
    </>
  ),
  github: (
    <path d="M9 2a7 7 0 00-2.21 13.64c.35.06.48-.15.48-.34v-1.2c-1.95.42-2.36-.94-2.36-.94-.32-.81-.78-1.03-.78-1.03-.64-.43.05-.42.05-.42.7.05 1.07.72 1.07.72.62 1.06 1.63.76 2.03.58.06-.45.24-.76.44-.94-1.56-.18-3.2-.78-3.2-3.47 0-.77.27-1.4.72-1.89-.07-.18-.31-.9.07-1.87 0 0 .59-.19 1.94.72a6.7 6.7 0 013.53 0c1.35-.91 1.94-.72 1.94-.72.38.97.14 1.69.07 1.87.45.49.72 1.12.72 1.89 0 2.7-1.64 3.29-3.21 3.46.25.22.48.65.48 1.31v1.94c0 .19.13.41.49.34A7 7 0 009 2z" />
  ),
  linkedin: (
    <>
      <rect x="2.5" y="2.5" width="13" height="13" rx="1.5" />
      <path d="M6 8v4.2M6 5.9v.1M9 12.2V8m0 0c0-1 .7-1.6 1.6-1.6S12.2 7 12.2 8v4.2M9 8v0" />
    </>
  ),
  clock: (
    <>
      <circle cx="9" cy="9" r="6.5" />
      <path d="M9 5.5V9l2.5 1.5" />
    </>
  ),
  users: (
    <>
      <circle cx="6.5" cy="6.5" r="2.5" />
      <path d="M2 15c0-2.2 2-4 4.5-4s4.5 1.8 4.5 4" />
      <path d="M11.5 4.2a2.5 2.5 0 010 4.85M13.5 15c0-2-1.4-3.6-3.3-3.95" />
    </>
  ),
  star: <path d="M9 2.5l1.9 3.9 4.3.6-3.1 3 .7 4.3L9 12.3l-3.8 2 .7-4.3-3.1-3 4.3-.6z" />,
  'map-pin': (
    <>
      <path d="M9 16s5.5-4.8 5.5-9A5.5 5.5 0 003.5 7c0 4.2 5.5 9 5.5 9z" />
      <circle cx="9" cy="7" r="1.8" />
    </>
  ),
  search: (
    <>
      <circle cx="8" cy="8" r="5" />
      <path d="M12 12l3.5 3.5" />
    </>
  ),
  x: <path d="M4.5 4.5l9 9m0-9l-9 9" />,
  plus: <path d="M9 3.5v11M3.5 9h11" />,
  message: (
    <path d="M3 4.5h12a1 1 0 011 1V12a1 1 0 01-1 1H8l-3.5 3V13H3a1 1 0 01-1-1V5.5a1 1 0 011-1z" />
  ),
  eye: (
    <>
      <path d="M1.5 9S4 4 9 4s7.5 5 7.5 5-2.5 5-7.5 5-7.5-5-7.5-5z" />
      <circle cx="9" cy="9" r="2.2" />
    </>
  ),
  briefcase: (
    <>
      <rect x="2" y="6" width="14" height="9" rx="1.5" />
      <path d="M6.5 6V4.5a1.5 1.5 0 011.5-1.5h2a1.5 1.5 0 011.5 1.5V6" />
    </>
  ),
  award: (
    <>
      <circle cx="9" cy="7" r="4.2" />
      <path d="M6.5 10.5L5.5 16l3.5-2 3.5 2-1-5.5" />
    </>
  ),
  refresh: (
    <path d="M15 9a6 6 0 10-1.76 4.24M15 9V5m0 4h-4M3 9a6 6 0 011.76-4.24" />
  ),
  edit: (
    <path d="M11.5 3.5l3 3L5 16l-3.5.5L2 13z" />
  ),
  calendar: (
    <>
      <rect x="2.5" y="4" width="13" height="11" rx="1.5" />
      <path d="M2.5 7.5h13M6 2.5v3M12 2.5v3" />
    </>
  ),
  link: (
    <path d="M7.5 10.5a3 3 0 004.24 0l2-2a3 3 0 00-4.24-4.24l-1 1M10.5 7.5a3 3 0 00-4.24 0l-2 2a3 3 0 004.24 4.24l1-1" />
  ),
  inbox: (
    <>
      <path d="M2.5 10.5h4l1 2h3l1-2h4" />
      <path d="M2.5 10.5L4 4.5a1.5 1.5 0 011.5-1.2h7a1.5 1.5 0 011.5 1.2l1.5 6" />
      <path d="M2.5 10.5v3a1.5 1.5 0 001.5 1.5h10a1.5 1.5 0 001.5-1.5v-3" />
    </>
  ),
}

export function Icon({ name, size = 16, strokeWidth = 1.75, style, ...rest }: {
  name: IconName
  size?: number
  strokeWidth?: number
} & React.SVGAttributes<SVGSVGElement>) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 18 18" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }}
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  )
}
