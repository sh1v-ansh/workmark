'use client'

import type { EventName, EventProps } from './events'

/**
 * Record that something happened, from the browser.
 *
 * ── The three rules ───────────────────────────────────────────────────────
 * It never throws, it never blocks, and it never makes the caller wait.
 * Analytics that can break a page is worse than no analytics, and a `track`
 * somebody has to remember to await is one that eventually gets awaited in
 * a click handler and adds 200ms to a button.
 *
 * sendBeacon where it exists, because the events worth having most are the
 * ones fired as a page goes away — "they opened signup and left" is the
 * number a waitlist lives on, and an ordinary fetch is cancelled on unload.
 */

const SESSION_KEY = 'wm-session'

/**
 * An id for this visit, so a session can be followed from a landing page
 * through to a finished profile.
 *
 * sessionStorage, not localStorage: it dies with the tab, which is what
 * makes it a session id rather than a device id. Wrapped in try/catch
 * because a private window or blocked site data makes every access throw,
 * and an analytics helper that breaks a page in Safari private browsing is
 * precisely the thing rule one is about.
 */
/** The tab's analytics session id, so the server can stitch pre-account
 *  events to the student once their profile exists. */
export function currentSessionId(): string | null {
  return sessionId()
}

function sessionId(): string | null {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY)
    if (existing) return existing
    const fresh = crypto.randomUUID()
    sessionStorage.setItem(SESSION_KEY, fresh)
    return fresh
  } catch {
    return null
  }
}

export function track(name: EventName, props: EventProps = {}): void {
  try {
    const body = JSON.stringify({ name, sessionId: sessionId(), props })

    // Survives the page being closed. Queued by the browser and sent
    // independently of the document, which an ordinary fetch is not.
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const ok = navigator.sendBeacon('/api/events', new Blob([body], { type: 'application/json' }))
      if (ok) return
      // Falls through on failure — sendBeacon returns false when its queue
      // is full rather than throwing, and dropping silently there would be
      // the one case where events go missing under load.
    }

    void fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Nothing here is worth a broken page.
  }
}
