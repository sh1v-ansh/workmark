// Compact badge — the "o" from the workmark wordmark, extracted so it
// stays legible against any background. Callers pair it with the word
// "workmark" set in Playfair Display next to it.
export function LogoMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="wm-badge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3E1FFF" />
          <stop offset="100%" stopColor="#5A3FFF" />
        </linearGradient>
      </defs>
      <circle cx="10" cy="10" r="9.25" fill="url(#wm-badge)" />
      <path
        d="M5.5 10.5 L8.6 13.8 L14.6 6.6"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}
