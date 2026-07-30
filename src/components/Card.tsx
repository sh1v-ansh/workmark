import Link from 'next/link'
import { C } from '@/lib/theme/dark-tokens'

// Shared card shell — rounded corners + the existing .wm-card hover
// lift/shadow (defined in globals.css), instead of the flat 1px-bordered
// rectangles that were hand-rolled per component across the app.
interface CardProps {
  href?: string
  onClick?: () => void
  padding?: number | string
  style?: React.CSSProperties
  className?: string
  children: React.ReactNode
  hoverable?: boolean
}

export default function Card({ href, onClick, padding = 20, style, className, children, hoverable }: CardProps) {
  const interactive = hoverable ?? (!!href || !!onClick)
  const baseStyle: React.CSSProperties = {
    display: 'block',
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 14,
    padding,
    textDecoration: 'none',
    color: 'inherit',
    ...style,
  }
  const cls = [interactive ? 'wm-card' : '', className].filter(Boolean).join(' ')

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
