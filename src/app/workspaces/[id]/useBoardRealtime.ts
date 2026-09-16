'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Other people's changes, without a refresh button.
 *
 * ── Why this refetches rather than patching state ─────────────────────────
 * The obvious build is to take the row out of the change payload and merge it
 * into local state. It is wrong here for a reason that is not about effort:
 * the board's state is derived from six queries — tasks, verdicts, sprints,
 * messages, checkpoints, dependencies — and a task row arriving on its own
 * cannot update the four of those that depend on it. Merging would produce a
 * card whose column is current and whose verdict, thread and progress are
 * from a minute ago, and no amount of care makes that converge.
 *
 * Refetching is one line and cannot desync. It costs a round trip on a page
 * somebody is already looking at.
 *
 * ── Why it waits ─────────────────────────────────────────────────────────
 * A card that jumps while you are dragging it is worse than a stale board,
 * and a dialog that reloads under a half-typed message is worse than both.
 * So a change arriving while the student is mid-action is remembered, not
 * applied, and lands the moment they finish.
 *
 * ── Why it is debounced ──────────────────────────────────────────────────
 * One plan writes eight tasks, which is eight events inside a second. Without
 * a window that is eight refetches for one logical change.
 *
 * RLS already decides who may read `tasks`, and Realtime enforces it on the
 * channel, so there is no new authorisation here — a student who cannot see a
 * project cannot subscribe to it either.
 */

/** Long enough to swallow a batch insert, short enough to feel immediate. */
const SETTLE_MS = 600

export function useBoardRealtime(
  workspaceId: string,
  args: {
    /** True while a drag or a dialog is in progress. Changes wait. */
    paused: boolean
    onChange: () => void
  },
) {
  // Held in refs so the subscription is created once per project rather than
  // torn down and rebuilt every time the board re-renders — which is every
  // keystroke in any dialog on it.
  const pausedRef = useRef(args.paused)
  const onChangeRef = useRef(args.onChange)
  const waitingRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    pausedRef.current = args.paused
    onChangeRef.current = args.onChange
  })

  // Whatever arrived while they were busy, applied as soon as they are not.
  useEffect(() => {
    if (!args.paused && waitingRef.current) {
      waitingRef.current = false
      args.onChange()
    }
  }, [args.paused, args.onChange])

  useEffect(() => {
    const supabase = createClient()

    const flush = () => {
      if (pausedRef.current) {
        waitingRef.current = true
        return
      }
      onChangeRef.current()
    }

    const schedule = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(flush, SETTLE_MS)
    }

    const channel = supabase
      .channel(`board:${workspaceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `workspace_id=eq.${workspaceId}` },
        schedule,
      )
      // Verdicts land from the nightly pass and from a teammate pressing
      // Check, neither of which touches `tasks` — a board that only watched
      // tasks would show work sitting in Submitted that had already been
      // answered.
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_submissions', filter: `workspace_id=eq.${workspaceId}` },
        schedule,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workspace_messages', filter: `workspace_id=eq.${workspaceId}` },
        schedule,
      )
      .subscribe()

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      supabase.removeChannel(channel)
    }
  }, [workspaceId])
}
