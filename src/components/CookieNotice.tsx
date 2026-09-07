'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const STORAGE_KEY = 'wm-cookie-choice'

type Choice = 'accepted' | 'rejected'

/**
 * Whether the visitor has agreed to non-essential cookies.
 *
 * Read this before loading anything that sets one — a session recorder, an
 * embedded video, any analytics that works by tagging a browser. Nothing
 * calls it yet, and that is still honest: Workmark sets exactly one cookie,
 * the Supabase session, which is "strictly necessary" under both the
 * ePrivacy Directive and CCPA.
 *
 * Analytics arrived and did not change that, because the one chosen is
 * cookieless — Vercel counts a visit by hashing the request, keeps nothing
 * that survives the day, and sets nothing in the browser. That was most of
 * the reason to choose it. Something like Google Analytics would have to be
 * loaded behind this gate instead, and the banner would have to become a
 * real question.
 *
 * So this file is still the gate, built before the thing it gates. The
 * failure mode it exists to prevent is the usual one: a tracker gets added
 * in a hurry one afternoon, starts firing on page load, and consent becomes
 * a banner that lies.
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
 * required and offering them a button to refuse it would be theatre. The
 * Reject button starts meaning something the day anything cookie-based is
 * loaded behind hasCookieConsent(), and the wording changes with it.
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
        // Product chrome, not marketing copy — it says the same thing on the
        // landing page and inside the app, so it takes the app's face rather
        // than switching identity depending on which page it lands over.
        fontFamily: "var(--font-app), 'Instrument Sans', system-ui, sans-serif",
        background: '#FFFFFF', border: '1px solid #DDDCE8', borderRadius: 12,
        boxShadow: '0 8px 28px rgba(25,30,46,0.14)',
        padding: '16px 18px',
        display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap',
      }}
    >
      <p style={{ flex: '1 1 260px', fontSize: 13, color: '#5A6172', lineHeight: 1.55, margin: 0 }}>
        Workmark uses one cookie, to keep you signed in. Our analytics counts page
        views without cookies and can&apos;t follow you to other sites. We don&apos;t
        use advertising or tracking cookies.{' '}
        <Link href="/legal/cookies" style={{ color: '#191E2E' }}>Cookie Policy</Link>
        {' · '}
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
