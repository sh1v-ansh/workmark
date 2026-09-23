'use client'

import Button from '@/components/ui/Button'
import { C } from '@/lib/theme/dark-tokens'

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
 * ── The empty-GitHub case (no skip) ──────────────────────────────────────
 * Most of the waitlist is first-years. An empty account is not a failure
 * here and the copy says so — the dashboard offers them a project to build.
 */
export default function GithubStep({ onSkip: _onSkip, busy: _busy }: { onSkip: () => void; busy: boolean }) {
  // No skip. Every path needs GitHub: the scan reads it, and a guided project
  // is built in a repository we read too. An empty account is fine; we help
  // fill it.
  return (
    <div>
      <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6, marginBottom: 8 }}>
        Your profile is built from the code you write. You choose which repositories we read.
      </p>
      <p style={{ fontSize: 13, color: C.textFaint, lineHeight: 1.55, marginBottom: 22 }}>
        Nothing on GitHub yet? Connect it anyway. We&rsquo;ll give you a project to build and fill it up together.
      </p>

      {/* The consent page first, then GitHub. The install route refuses
          anybody without a recorded consent, so going straight there would
          only bounce through it anyway. */}
      <Button
        href="/student/github/consent"
        variant="accent"
        fullWidth
      >
        {/* Counted on the server when the install route is hit, which
            covers every Connect button, not just this one. */}
        Connect GitHub
      </Button>

      <p style={{ fontSize: 13, color: C.textFaint, textAlign: 'center', marginTop: 12 }}>
        No GitHub account?{' '}
        <a href="https://github.com/signup" target="_blank" rel="noopener noreferrer" style={{ color: C.accent }}>
          Create one free
        </a>
        , then come back.
      </p>
    </div>
  )
}
