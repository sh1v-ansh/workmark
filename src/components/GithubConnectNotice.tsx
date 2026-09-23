'use client'

import { useEffect, useState } from 'react'
import { C, R, T } from '@/lib/theme/dark-tokens'

/**
 * What the GitHub callback came back with.
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 * The callback has always set `gh_connected` or `gh_error` on the URL it
 * redirects to, and nothing anywhere read either. So a failed connection —
 * an org install waiting on an admin, a callback that threw — landed a
 * student on the dashboard with no word about it, looking exactly like a
 * connection that had worked. They found out when a scan had nothing to
 * read, if they found out at all.
 *
 * Read from window rather than useSearchParams, which would force the page
 * behind a Suspense boundary for one flag, and cleared from the URL so a
 * reload does not repeat a message about something already dealt with.
 */
const ERRORS: Record<string, string> = {
  installation_pending_approval:
    'GitHub is waiting on an organisation admin to approve the install. Once they do, come back here — or install it on your personal account instead.',
  missing_installation_id:
    'GitHub did not say which installation to use, so nothing was connected. Try connecting again.',
  callback_failed:
    'GitHub connected, but we could not finish setting it up on our side. Try connecting again — if it keeps happening, tell us from the menu.',
  not_configured:
    'GitHub connections are not set up on this deployment yet. This is on us, not you.',
}

export default function GithubConnectNotice() {
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const error = params.get('gh_error')
    const connected = params.get('gh_connected')
    if (!error && !connected) return

    setNotice(error
      ? { ok: false, text: ERRORS[error] ?? 'Connecting GitHub did not work. Try again.' }
      : { ok: true, text: 'GitHub is connected. Check which repositories are switched on below, then scan.' })

    params.delete('gh_error')
    params.delete('gh_connected')
    const rest = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : ''))
  }, [])

  if (!notice) return null

  return (
    <div
      role={notice.ok ? 'status' : 'alert'}
      style={{
        borderRadius: R.md, padding: '12px 15px', marginBottom: 18,
        fontSize: T.bodySm, lineHeight: 1.6,
        background: notice.ok ? '#DEF1E6' : '#FCE9E9',
        color: notice.ok ? '#14663D' : '#B91C1C',
      }}
    >
      {notice.text}
      {!notice.ok && (
        <a href="/student/github" style={{ marginLeft: 8, color: 'inherit', fontWeight: 600 }}>
          Try again
        </a>
      )}
    </div>
  )
}
