'use client'

import Button from '@/components/ui/Button'
import { C, R, T } from '@/lib/theme/dark-tokens'
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
 * ── Why it says what it reads before asking ───────────────────────────────
 * GitHub's own screen says "read access to code and metadata", which is a
 * permission rather than a purpose. Somebody deciding whether to give a
 * stranger's app access to their code deserves the purpose first.
 *
 * ── The empty-GitHub case ─────────────────────────────────────────────────
 * Most of the waitlist is first-years. An empty account is not a failure
 * here and the copy says so — the dashboard offers them a project to build.
 */
export default function GithubStep({ onSkip, busy }: { onSkip: () => void; busy: boolean }) {
  return (
    <div>
      <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6, marginBottom: 18 }}>
        Your record comes from code you actually wrote. Connect GitHub and choose which
        repositories Workmark may read — nothing is read until you say so.
      </p>

      <ul style={{ margin: '0 0 22px', padding: 0, listStyle: 'none', display: 'grid', gap: 10 }}>
        {[
          ['You choose the repositories', 'Private ones stay off unless you turn them on. Never enable an employer’s code.'],
          ['We read structure, not your whole codebase', 'Dependencies, imports and who wrote which commits — enough to tell what you built.'],
          ['Nothing there yet? That’s fine', 'Most people start with an empty GitHub. We’ll give you a project to build instead.'],
        ].map(([title, detail]) => (
          <li key={title} style={{ background: C.surfaceAlt, borderRadius: R.md, padding: '11px 14px' }}>
            <p style={{ fontSize: T.bodySm, fontWeight: 600, color: C.text, marginBottom: 2 }}>{title}</p>
            <p style={{ fontSize: 13, color: C.textFaint, lineHeight: 1.55 }}>{detail}</p>
          </li>
        ))}
      </ul>

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
