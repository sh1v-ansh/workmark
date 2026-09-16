'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { C, R, T } from '@/lib/theme/dark-tokens'
import { Icon } from '@/components/Icon'

/**
 * A panel that slides in from the right while the page stays visible behind it.
 *
 * Chosen over a modal for the apply form specifically: what you're writing is
 * an answer to the listing's requirements, so covering the listing to ask for
 * that answer is the wrong trade. The page dims but stays readable.
 *
 * Handles the things a hand-rolled overlay usually gets wrong — Esc to close,
 * focus moved into the panel and trapped there, background scroll locked, and
 * a labelled dialog role so it isn't invisible to a screen reader.
 */
export default function Drawer({ open, onClose, title, subtitle, children, footer, width = 560 }: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  /** Pinned to the bottom of the panel — actions stay reachable without scrolling. */
  footer?: React.ReactNode
  width?: number
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  /**
   * Kept out of the setup effect's dependencies on purpose — see Modal, which
   * had the same defect. Callers pass `onClose` inline, so depending on it
   * re-ran the focus trap after every keystroke, and each re-run moved focus
   * off the field being typed into.
   */
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    if (!open) return

    // Remember what had focus so it can be handed back on close — otherwise
    // closing the drawer drops the keyboard user back at the top of the page.
    const previouslyFocused = document.activeElement as HTMLElement | null

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        closeRef.current()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return

      // Focus trap: without this, Tab walks out of the panel and into the
      // dimmed page behind it, which is confusing and leaves the drawer's
      // own actions unreachable by keyboard.
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
    // Focus the panel itself rather than its first field: dropping the cursor
    // straight into a textarea skips the heading, so a screen reader user
    // never hears what they just opened.
    panelRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus?.()
    }
  }, [open])

  // Portals need a DOM to render into, which the server does not have.
  // Mounted flips after hydration; before that the overlay renders nothing,
  // which is correct — an overlay is never part of the first paint.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!open || !mounted) return null


  /**
   * Rendered into document.body rather than where it is written.
   *
   * A fixed overlay's z-index only competes inside its nearest stacking
   * context, and any ancestor with a transform, a filter, a backdrop-filter or
   * its own z-index makes one. This drawer sat at z-60 and the app header at
   * z-40, and the header still painted over it — because the drawer's 60 was
   * being resolved inside a context that itself sat below the header, so the
   * number never got compared with 40 at all.
   *
   * Portalling to body puts it in the root stacking context, where the z-index
   * below means what it says. It is also the only fix that stays fixed: the
   * alternative is auditing every ancestor of every overlay forever.
   */
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
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
          position: 'absolute', top: 0, right: 0, bottom: 0,
          width: `min(${width}px, 100vw)`,
          background: C.bg,
          borderLeft: `1px solid ${C.border}`,
          boxShadow: '-18px 0 48px rgba(25,30,46,0.13)',
          display: 'flex', flexDirection: 'column',
          animation: 'nb-drawer-in 220ms cubic-bezier(0.22, 1, 0.36, 1)',
          outline: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '20px 24px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: T.h2, fontWeight: 600, color: C.text, letterSpacing: '-0.02em' }}>{title}</h2>
            {subtitle && <p style={{ fontSize: T.bodySm, color: C.textFaint, marginTop: 4, lineHeight: 1.5 }}>{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ flexShrink: 0, width: 32, height: 32, borderRadius: R.md, border: `1px solid ${C.border}`, background: C.surface, color: C.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="x" size={15} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>{children}</div>

        {footer && (
          <div style={{ flexShrink: 0, padding: '15px 24px', borderTop: `1px solid ${C.border}`, background: C.surface }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
