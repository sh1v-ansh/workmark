import { C } from './tokens'

export function LogoMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <line x1="2" y1="5" x2="13" y2="5" stroke={C.text} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="2" y1="10" x2="11" y2="10" stroke={C.text} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="2" y1="15" x2="8" y2="15" stroke={C.text} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="15.5" cy="15" r="3.5" stroke={C.accent} strokeWidth="1.2" />
      <path d="M14 15l1 1 2-2" stroke={C.accent} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
