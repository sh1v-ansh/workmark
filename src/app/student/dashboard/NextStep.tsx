'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/Card'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import Button from '@/components/ui/Button'
import { C, F, T } from '@/lib/theme/dark-tokens'
import { nextStepFor, type Intent, type NextStep } from '@/lib/profile/intents'
import RescanButton from '@/components/RescanButton'
import FinishProfile from './FinishProfile'

/**
 * The one thing to do next, decided rather than listed.
 *
 * ── Why this is not a checklist ───────────────────────────────────────────
 * A checklist of five things somebody has not done is a list of five ways
 * they are behind. This says one thing, and it is the thing that unblocks
 * the rest — which for almost everybody is not the thing they would have
 * picked off a list.
 *
 * ── The first-year case, which is most of the waitlist ────────────────────
 * Somebody who has just started a CS degree connects GitHub, has nothing in
 * it, and gets a record with nothing on it. That is accurate and it reads as
 * a verdict on a person who has not had the chance to do anything yet — the
 * single worst first impression this product can make, delivered to exactly
 * the people it should be most useful to.
 *
 * So an empty GitHub beats everything else, including what they said they
 * wanted, and the answer is a project to build. Having something to show is
 * a precondition for the other three anyway.
 */
const COPY: Record<Exclude<NextStep, 'nothing'>, {
  eyebrow: string
  headline: string
  body: string
  cta: string
  href: string
}> = {
  connect_github: {
    eyebrow: 'Start here',
    headline: 'Connect GitHub to build your record',
    body: 'Workmark reads the repositories you choose and works out what you can actually build. You pick which ones, and nothing is read until you say so.',
    cta: 'Connect GitHub',
    href: '/student/github',
  },
  start_guided_project: {
    eyebrow: 'Start here',
    headline: 'Nothing to read yet — so let’s build something',
    body: 'Most people start with an empty GitHub. We’ll suggest a project and guide you through it.',
    cta: 'Get a project to build',
    href: '/goals',
  },
  scan: {
    eyebrow: 'Start here',
    headline: 'Scan your GitHub',
    body: 'Connecting was step one. The scan reads your code and builds your verified record. It keeps running even if you close the tab.',
    cta: 'Scan',
    href: '/student/github',
  },
  finish_profile: {
    eyebrow: 'Next step',
    headline: 'Pick your career path',
    body: 'Tell us where you’re headed and we’ll show you the next skill to build and projects that get you there.',
    cta: 'Choose my career path',
    href: '#career-path',
  },
  be_discoverable: {
    eyebrow: 'Next step',
    headline: 'Let other students find you',
    body: 'Show up in the student directory for people starting projects.',
    cta: 'Make me findable',
    href: '/listings?tab=people',
  },
  post_project: {
    eyebrow: 'Next step',
    headline: 'Find people to build your project with',
    body: 'Say what you’re making and which skills you need.',
    cta: 'Post a project',
    href: '/listings/new',
  },
  find_work: {
    eyebrow: 'Next step',
    headline: 'Find a project to work on',
    body: 'Your verified record goes with every application.',
    cta: 'Find work',
    href: '/listings',
  },
}

export default function NextStepCard({
  intents,
  githubConnected,
  repoCount,
  evidenceCount,
  openToCollab,
  postedCount,
  studentId,
  lastScannedAt,
  major,
  careerTrack,
}: {
  intents: Intent[]
  githubConnected: boolean
  repoCount: number
  evidenceCount: number
  openToCollab: boolean
  postedCount: number
  studentId: string
  lastScannedAt: string | null
  major: string | null
  careerTrack: string | null
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  const step = nextStepFor({
    intents, githubConnected, repoCount, evidenceCount, openToCollab, postedCount,
    lastScannedAt, profileComplete: !!major && !!careerTrack,
  })
  if (step === 'nothing') return null
  // Major first, in its own small form; then the career path card below.
  if (step === 'finish_profile' && !major) return <FinishProfile prominent />

  // Done in place, not by sending them to the directory to find a switch.
  async function makeFindable() {
    setBusy(true)
    const { error } = await createClient().from('students').update({ open_to_collab: true }).eq('id', studentId)
    setBusy(false)
    if (error) {
      toast('Could not update that. Try again from the Students page.', 'error')
      return
    }
    toast('You now show up in the student directory.', 'success')
    router.refresh()
  }

  const copy = COPY[step]

  return (
    // A slim row under the greeting, not a banner over it: it is a pointer
    // to the next thing, and the page's own content should still lead.
    <Card
      hoverable={false}
      padding="12px 16px"
      style={{ marginBottom: 12, ...(step === 'scan' || step === 'finish_profile' ? { border: '1px solid #D9CCFF', background: '#FAF8FF' } : {}) }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <p style={{ fontSize: T.bodySm, color: C.textSub, minWidth: 0 }}>
          <span style={{ fontSize: T.meta, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.accent, marginRight: 8 }}>
            {copy.eyebrow}
          </span>
          <strong style={{ fontWeight: 600, color: C.text }}>{copy.headline}</strong>
          <span style={{ color: C.textMuted }}> · {copy.body}</span>
        </p>
        {step === 'scan' ? (
          <RescanButton githubConnected variant="gradient" size="sm" showLastScan={false} label="Scan my GitHub" />
        ) : step === 'finish_profile' ? (
          <Button href={copy.href} variant="gradient" size="sm">{copy.cta}</Button>
        ) : step === 'be_discoverable' ? (
          <Button variant="accent" size="sm" onClick={makeFindable} busyLabel={busy ? 'Saving…' : null}>{copy.cta}</Button>
        ) : (
          <Button href={copy.href} variant="accent" size="sm">{copy.cta}</Button>
        )}
      </div>
    </Card>
  )
}
