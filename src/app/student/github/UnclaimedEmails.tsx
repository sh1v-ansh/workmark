'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/Toast'
import { C, R, T } from '@/lib/theme/dark-tokens'

export interface UnclaimedEmailRow {
  email: string
  display_name: string | null
  repo_full_name: string
  commit_count: number
}

/**
 * "41 commits here are from priya@lab-machine.local — is that you?"
 *
 * ── Why this question is on the screen at all ─────────────────────────────
 * The scanner used to ask GitHub which commits were the student's, and
 * GitHub only matches addresses verified against the account. Commit from a
 * lab machine, or with a university address, or before adding that address
 * to GitHub, and the answer is none — so a student got no evidence from a
 * repository they wrote every line of, and the page told them "we read it,
 * but found no commits of yours", which reads as a verdict on their work.
 *
 * Nobody but them can answer this. GitHub does not know, and the git config
 * on the machine they used is not something we can see. So it is a question
 * rather than a guess, and it is on this page because this is where "my work
 * isn't showing up" actually happens.
 *
 * ── Why answering is safe ─────────────────────────────────────────────────
 * An address only appears here when GitHub attributed those commits to
 * nobody at all. Anything GitHub attributes to an account is never offered,
 * so two students can never claim the same commits.
 */
export default function UnclaimedEmails({ rows }: { rows: UnclaimedEmailRow[] }) {
  const { toast } = useToast()
  const [pending, setPending] = useState<string | null>(null)
  const [settled, setSettled] = useState<Set<string>>(new Set())

  // Grouped by address: the same lab machine shows up across every repo they
  // used it on, and asking five times about one answer is five times worse
  // than asking once.
  const byEmail = new Map<string, { name: string | null; commits: number; repos: string[] }>()
  for (const r of rows) {
    if (settled.has(r.email)) continue
    const at = byEmail.get(r.email) ?? { name: r.display_name, commits: 0, repos: [] }
    at.commits += r.commit_count
    if (!at.repos.includes(r.repo_full_name)) at.repos.push(r.repo_full_name)
    byEmail.set(r.email, at)
  }

  if (byEmail.size === 0) return null

  async function answer(email: string, value: 'mine' | 'not-mine') {
    setPending(email)
    try {
      const res = await fetch('/api/github/commit-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, answer: value }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not save that.')
      setSettled((s) => new Set(s).add(email))
      toast(data.message ?? 'Saved.', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save that.', 'error')
    } finally {
      setPending(null)
    }
  }

  return (
    <div style={{
      border: `1px solid ${C.accentBorder}`, background: C.surfaceAlt,
      borderRadius: R.lg, padding: '16px 18px', marginBottom: 20,
    }}>
      <p style={{ fontSize: T.h3, fontWeight: 600, color: C.text, marginBottom: 4 }}>
        {byEmail.size === 1 ? 'Is this address yours?' : 'Are these addresses yours?'}
      </p>
      <p style={{ fontSize: T.bodySm, color: C.textMuted, lineHeight: 1.6, marginBottom: 14, maxWidth: '64ch' }}>
        We found commits signed with {byEmail.size === 1 ? 'an address' : 'addresses'} GitHub
        doesn&apos;t recognise — usually a laptop or lab machine set up with a different email.
        Telling us counts that work towards your record.
      </p>

      <div style={{ display: 'grid', gap: 9 }}>
        {Array.from(byEmail.entries()).map(([email, info]) => (
          <div
            key={email}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, flexWrap: 'wrap',
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: R.md, padding: '11px 13px',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: T.bodySm, color: C.text, fontWeight: 500 }}>
                {email}
              </p>
              <p style={{ fontSize: T.meta, color: C.textFaint, marginTop: 2 }}>
                {/* The configured name first: an address alone is often
                    unrecognisable, and "Priya R" is what makes this
                    answerable at a glance. */}
                {info.name ? `${info.name} · ` : ''}
                {info.commits} commit{info.commits === 1 ? '' : 's'}
                {' in '}
                {info.repos.length === 1 ? info.repos[0] : `${info.repos.length} repositories`}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
              <Button
                size="sm"
                onClick={() => answer(email, 'mine')}
                busyLabel={pending === email ? 'Saving…' : null}
              >
                Yes, that&apos;s me
              </Button>
              <Button
                variant="quiet" size="sm"
                onClick={() => answer(email, 'not-mine')}
                disabled={pending === email}
              >
                Not me
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
