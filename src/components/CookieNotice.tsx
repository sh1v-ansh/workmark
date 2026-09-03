'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const STORAGE_KEY = 'wm-cookie-choice'

type Choice = 'accepted' | 'rejected'

/**
 * Whether the visitor has agreed to non-essential cookies.
 *
 * Read this before loading anything that sets one — analytics, a session
 * recorder, an embedded video. Nothing calls it yet, which is the honest
 * state of things: Workmark currently sets exactly one cookie, the Supabase
 * session, and a login cookie is "strictly necessary" under both the ePrivacy
 * Directive and CCPA. There is nothing to ask permission for.
 *
 * So this file is the gate, built before the thing it gates. The failure
 * mode it exists to prevent is the usual one: analytics gets added in a
 * hurry one afternoon, starts firing on page load, and consent becomes a
 * banner that lies.
 */
export function hasCookieConsent(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'accepted'
  } catch {
    // Private mode, or storage blocked. Treat as "not agreed".
    return false
  }
}

/**
 * The notice itself.
 *
 * Written as a notice rather than a consent wall, because that is what the
 * situation actually is today — telling someone their login cookie is
 * required and offering them a button to refuse it would be theatre. When
 * analytics arrives, the Reject button starts meaning something and the
 * wording changes with it.
 *
 * Not a modal, doesn't block the page, and doesn't come back once
 * dismissed. Every dark pattern in this genre comes from treating the
 * banner as a conversion funnel.
 */
export function CookieNotice() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) setVisible(true)
    } catch {
      // Can't remember the answer, so don't ask a question we'd re-ask on
      // every page load.
    }
  }, [])

  function choose(choice: Choice) {
    try {
      window.localStorage.setItem(STORAGE_KEY, choice)
    } catch {
      // Nothing to do — the notice closes either way.
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      style={{
        position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 1000,
        maxWidth: 560, margin: '0 auto',
        background: '#FFFFFF', border: '1px solid #DCD6C8', borderRadius: 12,
        boxShadow: '0 8px 28px rgba(25,30,46,0.14)',
        padding: '16px 18px',
        display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap',
      }}
    >
      <p style={{ flex: '1 1 260px', fontSize: 13, color: '#5A6172', lineHeight: 1.55, margin: 0 }}>
        Workmark uses one cookie, to keep you signed in. We don&apos;t use advertising or
        tracking cookies, and there&apos;s no analytics on this site.{' '}
        <Link href="/legal/privacy" style={{ color: '#191E2E' }}>Privacy Policy</Link>
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => choose('rejected')} className="nb-btn nb-btn-quiet nb-btn-sm">
          No thanks
        </button>
        <button type="button" onClick={() => choose('accepted')} className="nb-btn nb-btn-ink nb-btn-sm">
          Got it
        </button>
      </div>
    </div>
  )
}
