import Link from 'next/link'

export type ButtonVariant = 'ink' | 'accent' | 'outline' | 'quiet' | 'danger'

interface CommonProps {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  fullWidth?: boolean
  className?: string
  children: React.ReactNode
}

type ButtonProps = CommonProps & {
  href?: undefined
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
  /** Replaces children while true and disables the button. */
  busyLabel?: string | null
}

type LinkProps = CommonProps & {
  href: string
  onClick?: never
  type?: never
  disabled?: never
  busyLabel?: never
}

/**
 * The app's only button.
 *
 * `variant` is a decision about meaning, not about looks:
 *   ink     — the workhorse. Almost everything.
 *   accent  — the ONE growth action on a page (build something, apply).
 *             Two accent buttons on a screen means one of them is wrong.
 *   outline — the secondary choice next to an ink button.
 *   quiet   — destructive-adjacent or low-stakes (withdraw, cancel).
 */
export default function Button(props: ButtonProps | LinkProps) {
  const { variant = 'ink', size = 'md', fullWidth, className, children } = props
  const cls = [
    'nb-btn',
    `nb-btn-${variant}`,
    size === 'sm' ? 'nb-btn-sm' : '',
    className,
  ].filter(Boolean).join(' ')
  const style: React.CSSProperties | undefined = fullWidth ? { width: '100%' } : undefined

  if (props.href !== undefined) {
    return (
      <Link href={props.href} className={cls} style={style}>
        {children}
      </Link>
    )
  }

  const busy = props.busyLabel != null
  return (
    <button
      type={props.type ?? 'button'}
      onClick={props.onClick}
      disabled={props.disabled || busy}
      className={cls}
      style={style}
    >
      {busy ? props.busyLabel : children}
    </button>
  )
}
