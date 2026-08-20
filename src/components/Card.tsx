import Link from 'next/link'

// The app's card shell. Bordered on paper rather than floated on white —
// elevation is reserved for things that genuinely sit above the page
// (toasts, menus), so a shadow here would be a lie about layering.
//
// Hover treatment only applies when the card actually goes somewhere. A
// static card that lifts under the cursor promises a click that never
// happens, which is the most common small dishonesty in card UI.
interface CardProps {
  href?: string
  onClick?: () => void
  padding?: number | string
  style?: React.CSSProperties
  className?: string
  children: React.ReactNode
  hoverable?: boolean
  /** Puts ruled-paper lines behind the content. The record only — see .nb-ruled. */
  ruled?: boolean
}

export default function Card({ href, onClick, padding = 18, style, className, children, hoverable, ruled }: CardProps) {
  const interactive = hoverable ?? (!!href || !!onClick)
  const baseStyle: React.CSSProperties = {
    display: 'block',
    padding,
    textDecoration: 'none',
    color: 'inherit',
    ...style,
  }
  const cls = [
    'nb-card',
    interactive ? 'nb-card-interactive' : '',
    ruled ? 'nb-ruled' : '',
    className,
  ].filter(Boolean).join(' ')

  if (href) {
    return (
      <Link href={href} className={cls} style={baseStyle}>
        {children}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button onClick={onClick} className={cls} style={{ ...baseStyle, width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}>
        {children}
      </button>
    )
  }
  return (
    <div className={cls} style={baseStyle}>
      {children}
    </div>
  )
}
