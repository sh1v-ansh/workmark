'use client'

import Button from '@/components/ui/Button'
import { C } from '@/lib/theme/dark-tokens'
import { track } from '@/lib/analytics/track'

/**
 * The last screen: connect the thing the record is read from.
 *
 * ── Why this is in signup rather than on the dashboard ────────────────────
 * It used to be a to-do waiting on a dashboard, four navigations from the
 * form that created the account. Without it the product does nothing — no
 * record, no matching, no profile — so it was the most important step and
 * the one furthest from where somebody's attention already was.
 *
 * GitHub sends them back to the repository list after installing, not to
 * the dashboard, so connect → choose → scan happens in one sitting.
 *
 * ── Why it is two lines ───────────────────────────────────────────────────
 * The consent page this links to explains exactly what is read. Saying it
 * here as well meant reading the same thing twice in a row.
 *
 * ── The empty-GitHub case ─────────────────────────────────────────────────
 * Most of the waitlist is first-years. An empty account is not a failure
 * here and the copy says so — the dashboard offers them a project to build.
 */
export default function GithubStep({ onSkip, busy }: { onSkip: () => void; busy: boolean }) {
  return (
    <div>
      <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6, marginBottom: 8 }}>
        Your record comes from code you wrote. You choose which repositories we read.
      </p>
      <p style={{ fontSize: 13, color: C.textFaint, lineHeight: 1.55, marginBottom: 22 }}>
        Nothing on GitHub yet? That&rsquo;s fine — skip this and we&rsquo;ll suggest a project.
      </p>

      {/* The consent page first, then GitHub. The install route refuses
          anybody without a recorded consent, so going straight there would
          only bounce through it anyway. */}
      <Button
        href="/student/github/consent"
        variant="accent"
        fullWidth
      >
        <span onClick={() => track('github_connect_started', { from: 'onboarding' })}>
          Connect GitHub
        </span>
      </Button>

      <button
        type="button"
        onClick={onSkip}
        disabled={busy}
        style={{
          display: 'block', margin: '12px auto 0', background: 'none', border: 'none', padding: 0,
          fontFamily: 'inherit', fontSize: 13, color: C.textFaint, textDecoration: 'underline', cursor: 'pointer',
        }}
      >
        {busy ? 'One moment…' : 'I’ll do this later'}
      </button>
    </div>
  )
}
