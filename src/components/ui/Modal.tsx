'use client'

import { useEffect, useRef } from 'react'
import { C, R, T, E } from '@/lib/theme/dark-tokens'
import { Icon } from '@/components/Icon'

/**
 * A centred dialog.
 *
 * Sibling to Drawer, and the choice between them is about what the page
 * behind is for. The drawer is right when you are answering something on the
 * page — an application written against a listing's requirements — so the
 * page has to stay readable. A modal is right when the page behind is a list
 * you were browsing and the thing you clicked is now the only thing that
 * matters. Reading where one skill came from is the second case.
 *
 * The unglamorous half — Esc, focus moved in and trapped, focus handed back
 * on close, background scroll locked, a labelled dialog role — is the same
 * as Drawer's and is the actual reason this is a component rather than a
 * div with a fixed position.
 */
export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 520,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  width?: number
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    // The panel, not its first control — otherwise a screen reader user is
    // dropped onto a close button having never heard what opened.
    panelRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(25,30,46,0.34)',
          backdropFilter: 'blur(2px)',
          animation: 'nb-drawer-fade 180ms ease',
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{
          position: 'relative',
          width: `min(${width}px, 100%)`,
          maxHeight: 'min(78vh, 720px)',
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: R.lg,
          boxShadow: E.overlay,
          display: 'flex', flexDirection: 'column',
          animation: 'nb-modal-in 200ms cubic-bezier(0.22, 1, 0.36, 1)',
          outline: 'none',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '19px 22px 15px', borderBottom: `1px solid ${C.borderFaint}`, flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: T.h2, fontWeight: 600, color: C.text, letterSpacing: '-0.02em' }}>{title}</h2>
            {subtitle && <div style={{ fontSize: T.bodySm, color: C.textFaint, marginTop: 5, lineHeight: 1.5 }}>{subtitle}</div>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ flexShrink: 0, width: 32, height: 32, borderRadius: R.md, border: `1px solid ${C.border}`, background: C.surface, color: C.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="x" size={15} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>{children}</div>

        {footer && (
          <div style={{ flexShrink: 0, padding: '14px 22px', borderTop: `1px solid ${C.borderFaint}`, background: C.bgAlt }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
