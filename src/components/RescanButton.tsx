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

  /**
   * Whether a scan was already running when this button appeared.
   *
   * The job id used to live only in this component's state, set when this
   * component started the scan. So navigating anywhere — dashboard to
   * record, which is the natural thing to do while waiting — remounted the
   * button knowing nothing, and it rendered as an ordinary "Rescan" while
   * the scan was still going.
   *
   * A scan takes minutes. Somebody who cannot tell "working" from "finished"
   * from "broken" concludes broken. So the button asks, every time it
   * mounts, rather than relying on having been the one to start it.
   *
   * 'asking' rather than a boolean, because the answer matters: until it
   * comes back we do not know whether pressing is the right thing to do, and
   * a button that says "Rescan" and then switches to "Scanning 4 of 12" a
   * moment later is its own small lie.
   */
  const [discovery, setDiscovery] = useState<'asking' | 'done'>('asking')

  useEffect(() => {
    if (!githubConnected) { setDiscovery('done'); return }
    let cancelled = false

    fetch('/api/github/scan', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled) return
        if (json?.job?.id) {
          setJobId(json.job.id as string)
          setJob(json.job as JobView)
        }
      })
      // A failed lookup is not a failed scan. Fall through to the ordinary
      // button rather than blocking on a question that did not answer.
      .catch(() => {})
      .finally(() => { if (!cancelled) setDiscovery('done') })

    return () => { cancelled = true }
  }, [githubConnected])

  /**
   * When the count last moved, so a scan that has stopped can say so.
   *
   * "I still don't know if the scan is complete and doesn't work, or if it's
   * still ongoing" is the complaint, and a progress bar that has not moved
   * for two minutes looks identical to one that is working slowly. A repo
   * takes seconds; nothing moving for a minute and a half means the worker
   * lost its chain, which /api/jobs/[id] is already quietly restarting on
   * every poll. Saying so turns a dead-looking screen into a slow one.
   */
  const movement = useRef({ done: -1, at: Date.now() })
  const [stalled, setStalled] = useState(false)

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

          // Moved, or not. 90 seconds matches the threshold the job route
          // uses to decide a job has lost its chain and restart it, so the
          // message appears at the same moment the fix is being attempted.
          if (next.completed_steps !== movement.current.done) {
            movement.current = { done: next.completed_steps, at: Date.now() }
            setStalled(false)
          } else if (Date.now() - movement.current.at > 90_000) {
            setStalled(true)
          }

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
            setStalled(false)
            movement.current = { done: -1, at: Date.now() }
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
  const total = job?.total_steps ?? 0
  const done = job?.completed_steps ?? 0
  const progress = total > 0 ? `${done} of ${total}` : null
  const fraction = total > 0 ? Math.min(done / total, 1) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: fullWidth ? 'stretch' : 'flex-start' }}>
      <Button
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        onClick={start}
        // Disabled while asking too. The answer decides what this button
        // means, and one that says "Rescan" and switches to "Scanning 4 of
        // 12" a moment later has already misled somebody into clicking.
        disabled={running || starting || discovery === 'asking'}
        busyLabel={
          running ? (progress ? `Scanning ${progress}…` : 'Scanning…')
            : starting ? 'Starting…'
              : discovery === 'asking' ? 'Checking…'
                : null
        }
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6.5 }}>
          <Icon name="refresh" size={12.5} />
          Rescan
        </span>
      </Button>

      {/* A bar, not just a label in the button.
          A scan runs for minutes and reads one repository at a time, and the
          complaint it produces is "I cannot tell whether this is working".
          A number that moves answers that in a way a spinner cannot: a
          spinner means "something", a bar means "four of twelve, and it
          moved since you last looked". */}
      {running && (
        <div style={{ width: fullWidth ? '100%' : 190 }}>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total || 1}
            aria-valuenow={done}
            aria-label="Scan progress"
            style={{ height: 4, borderRadius: 999, background: C.borderFaint, overflow: 'hidden' }}
          >
            <div style={{
              width: `${Math.max(fraction * 100, 3)}%`,
              height: '100%',
              background: C.accent,
              borderRadius: 999,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <span style={{ display: 'block', fontSize: 13, color: C.textFaint, marginTop: 5, lineHeight: 1.45 }}>
            {/* Named as repositories rather than steps, because that is the
                unit the student chose on the GitHub page and the only one
                that means anything to them. */}
            {stalled
              // The honest version of a bar that has stopped moving. The job
              // route restarts a stalled scan on every poll, so this is not
              // a dead end — but silence here is what makes somebody decide
              // the product is broken.
              ? `Still on ${progress ?? 'the first repository'} — this one is taking a while. Retrying.`
              : progress
                ? `Reading your repositories — ${progress} done.`
                : 'Starting the scan…'}
            {' '}
            {/* Said once, plainly. Otherwise somebody sits on the page
                waiting, which is exactly what we do not need them to do. */}
            Scans can take up to an hour with many repositories. It keeps running if you leave.
          </span>
        </div>
      )}

      {showLastScan && !running && discovery === 'done' && (
        <span style={{ fontSize: 13, color: C.textGhost }}>{lastScanLabel(lastScannedAt)}</span>
      )}
    </div>
  )
}
