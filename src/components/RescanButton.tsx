'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { Icon } from '@/components/Icon'
import { useToast } from '@/components/Toast'
import { C } from '@/lib/theme/dark-tokens'
import { lastScanLabel } from '@/lib/github/last-scan'

/**
 * Rescan, wherever the record is.
 *
 * This used to live in one place — a menu item called "Evidence source &
 * Rescan", four clicks and a page load away from the skills it changes. That
 * is the wrong home for it twice over: the action was named after the page
 * it opened rather than what it does, and it sat nowhere near the thing it
 * affects. It now goes beside the skill list on the dashboard and at the top
 * of the record, because those are the two places a student is standing when
 * they think "this is out of date".
 *
 * One component so the behaviour is identical in both: same label, same
 * progress, same result. Two buttons that do the same thing but behave
 * differently are worse than one button in the wrong place.
 *
 * The scan itself runs server-side, one repo at a time, and survives leaving
 * the page. This only queues it and then reports — so it polls rather than
 * awaits, and refreshes the page it is on when the work lands.
 */

interface JobView {
  id: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  total_steps: number
  completed_steps: number
  error?: string | null
  result?: { total?: number; failed?: number } | null
}

interface RescanButtonProps {
  /** No connection means there is nothing to rescan — offer the real first step. */
  githubConnected: boolean
  /** ISO timestamp of the last scan that finished, or null. */
  lastScannedAt?: string | null
  size?: 'sm' | 'md'
  variant?: 'ink' | 'outline' | 'quiet'
  fullWidth?: boolean
  /** Shows "Scanned 3 days ago" under the button. Off where the caller says it already. */
  showLastScan?: boolean
}

export default function RescanButton({
  githubConnected,
  lastScannedAt = null,
  size = 'sm',
  variant = 'outline',
  fullWidth,
  showLastScan = true,
}: RescanButtonProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [jobId, setJobId] = useState<string | null>(null)
  const [job, setJob] = useState<JobView | null>(null)
  const [starting, setStarting] = useState(false)

  // The toast function identity changes on every provider render, which would
  // restart the polling effect and re-fire the first tick. Held in a ref so
  // the effect depends only on the job it is actually watching.
  const toastRef = useRef(toast)
  toastRef.current = toast

  useEffect(() => {
    if (!jobId) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    async function tick() {
      try {
        const res = await fetch(`/api/jobs/${jobId}`, { cache: 'no-store' })
        const json = await res.json()
        if (cancelled) return
        if (res.ok && json.job) {
          const next = json.job as JobView
          setJob(next)
          if (next.status === 'succeeded' || next.status === 'failed' || next.status === 'cancelled') {
            const failed = next.result?.failed ?? 0
            const total = next.result?.total ?? next.total_steps
            toastRef.current(
              next.status === 'cancelled'
                ? 'Scan stopped.'
                : next.status === 'failed'
                  ? next.error ?? 'The scan could not read your repositories — try again in a minute.'
                  : failed > 0
                    ? `Scan complete — ${total - failed} of ${total} repositories read. ${failed} failed and can be retried.`
                    : `Scan complete — ${total} repositor${total === 1 ? 'y' : 'ies'} read.`,
              next.status === 'failed' ? 'error' : next.status === 'cancelled' ? 'info' : failed > 0 ? 'info' : 'success',
            )
            setJobId(null)
            setJob(null)
            // Pull the new skills onto whichever page this button is sitting
            // on, without a reload that would kill the toast above.
            router.refresh()
            return
          }
        }
      } catch {
        // One failed poll is not a failed scan — the job keeps running on the
        // server either way. Stay quiet and try again.
      }
      if (!cancelled) timer = setTimeout(tick, 2500)
    }

    timer = setTimeout(tick, 400)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [jobId, router])

  const start = useCallback(async () => {
    setStarting(true)
    try {
      const res = await fetch('/api/github/scan', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Could not start the scan.')
      setJobId(json.jobId)
      toastRef.current(
        json.alreadyRunning
          ? 'A scan is already running — showing its progress.'
          : `Reading ${json.totalSteps} repositor${json.totalSteps === 1 ? 'y' : 'ies'}. You can carry on using the site.`,
        'info',
      )
    } catch (err: unknown) {
      toastRef.current(err instanceof Error ? err.message : 'Could not start the scan.', 'error')
    } finally {
      setStarting(false)
    }
  }, [])

  // Nothing connected: rescanning is meaningless, so offer the step that is
  // actually available instead of a button that would only explain itself
  // after being pressed.
  if (!githubConnected) {
    return (
      <Button href="/student/github" variant="ink" size={size} fullWidth={fullWidth}>
        Connect GitHub
      </Button>
    )
  }

  const running = !!jobId
  const progress = job && job.total_steps > 0
    ? `${job.completed_steps} of ${job.total_steps}`
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: fullWidth ? 'stretch' : 'flex-start' }}>
      <Button
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        onClick={start}
        disabled={running || starting}
        busyLabel={running ? (progress ? `Scanning ${progress}…` : 'Scanning…') : starting ? 'Starting…' : null}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6.5 }}>
          <Icon name="refresh" size={12.5} />
          Rescan
        </span>
      </Button>
      {showLastScan && !running && (
        <span style={{ fontSize: 12, color: C.textGhost }}>{lastScanLabel(lastScannedAt)}</span>
      )}
    </div>
  )
}
