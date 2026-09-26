import Link from 'next/link'

export type ButtonVariant = 'ink' | 'accent' | 'outline' | 'quiet' | 'danger' | 'gradient'

interface CommonProps {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  fullWidth?: boolean
  className?: string
  children: React.ReactNode
  /**
   * Native tooltip, and the only honest way to ship a disabled control.
   * A button that refuses without saying why is the most annoying thing an
   * interface can do, and the reason is usually one short sentence.
   */
  title?: string
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
  const { variant = 'ink', size = 'md', fullWidth, className, children, title } = props
  const cls = [
    'nb-btn',
    `nb-btn-${variant}`,
    size === 'sm' ? 'nb-btn-sm' : '',
    className,
  ].filter(Boolean).join(' ')
  const style: React.CSSProperties | undefined = fullWidth ? { width: '100%' } : undefined

  if (props.href !== undefined) {
    return (
      <Link href={props.href} className={cls} style={style} title={title}>
        {children}
      </Link>
    )
  }

  const busy = props.busyLabel != null
  return (
    <button
      type={props.type ?? 'button'}
      title={title}
      onClick={props.onClick}
      disabled={props.disabled || busy}
      // Separate from `disabled` so the two can look different. They mean
      // opposite things — "you cannot do this" versus "it is happening" — and
      // rendering both at the same greyed-out opacity teaches people that a
      // click which was in fact working had failed.
      data-busy={busy ? 'true' : undefined}
      // Announced, because a sighted user sees the label change and a screen
      // reader user otherwise gets nothing at all for however long the call
      // takes.
      aria-busy={busy || undefined}
      className={cls}
      style={style}
    >
      {busy ? (
        <>
          <span className="nb-spinner" aria-hidden="true" />
          {props.busyLabel}
        </>
      ) : children}
    </button>
  )
}
