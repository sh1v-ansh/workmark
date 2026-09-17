'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  apply, emptyOverlay, isEmpty, tempId, withAdded, withPatched, withRemoved, without,
  type Overlay,
} from './optimistic'

export { tempId }

/**
 * A write that shows before the server has agreed to it.
 *
 * ── The timing that matters ───────────────────────────────────────────────
 * The overlay is held until the refreshed server data has actually arrived,
 * not until the request returns. Those are different moments, and dropping it
 * at the earlier one is the flicker everybody has seen: the card snaps back
 * to where it was for one frame, then forward again when the new props land.
 *
 * `router.refresh()` inside a transition gives us the later moment —
 * `isPending` stays true until the server components have re-rendered — so
 * the overlay comes off exactly when the truth is on screen.
 *
 * ── Why failures are loud ─────────────────────────────────────────────────
 * The claim is rolled back and a message says what did not happen. A card
 * that moves and then moves back with no explanation teaches somebody the
 * board is unreliable, which costs far more than the half second saved.
 */
export function useOptimistic<T extends { id: string }>(
  serverItems: T[],
  onError: (message: string) => void,
) {
  const router = useRouter()
  const [overlay, setOverlay] = useState<Overlay<T>>(emptyOverlay<T>())
  const [refreshing, startRefresh] = useTransition()

  // Cleared only once the refresh has landed. Holding it across the request
  // and the re-render is the whole point; see the note above.
  const wantsClear = useRef(false)
  useEffect(() => {
    if (!refreshing && wantsClear.current) {
      wantsClear.current = false
      setOverlay(emptyOverlay<T>())
    }
  }, [refreshing])

  const settle = useCallback(() => {
    wantsClear.current = true
    startRefresh(() => router.refresh())
  }, [router])

  /**
   * Claim a change, send it, and reconcile.
   *
   * `id` is what gets rolled back on failure — the real row's id for a patch
   * or removal, the temporary one for an addition — so one bad request never
   * undoes the others in flight.
   */
  const run = useCallback(async (
    id: string,
    claim: (current: Overlay<T>) => Overlay<T>,
    send: () => Promise<Response>,
    fallbackMessage: string,
  ): Promise<boolean> => {
    setOverlay(claim)
    try {
      const res = await send()
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? fallbackMessage)
      settle()
      return true
    } catch (err) {
      setOverlay((current) => without(current, id))
      onError(err instanceof Error ? err.message : fallbackMessage)
      return false
    }
  }, [onError, settle])

  return {
    /** Server data with pending changes shown on top. */
    items: apply(serverItems, overlay),
    /** True while something is claimed but not yet confirmed. */
    pending: !isEmpty(overlay) || refreshing,
    /** Whether one particular row is mid-flight, for styling it. */
    isPending: useCallback(
      (id: string) => overlay.patched[id] !== undefined
        || overlay.removed.includes(id)
        || overlay.added.some((a) => a.id === id),
      [overlay],
    ),

    add: useCallback((item: T, send: () => Promise<Response>, message: string) =>
      run(item.id, (o) => withAdded(o, item), send, message), [run]),

    patch: useCallback((id: string, changes: Partial<T>, send: () => Promise<Response>, message: string) =>
      run(id, (o) => withPatched(o, id, changes), send, message), [run]),

    remove: useCallback((id: string, send: () => Promise<Response>, message: string) =>
      run(id, (o) => withRemoved(o, id), send, message), [run]),

    /** For writes that change something other than this list. */
    refresh: settle,
  }
}
