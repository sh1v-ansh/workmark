import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import { C, F, T } from '@/lib/theme/dark-tokens'
import { nextStepFor, type Intent, type NextStep } from '@/lib/profile/intents'

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
    body: 'Your GitHub is empty, which is exactly where most people start. Workmark will write you a project worth building and take you through it one task at a time, and everything you write along the way lands on your record.',
    cta: 'Get a project to build',
    href: '/goals',
  },
  scan: {
    eyebrow: 'Nearly there',
    headline: 'Read your repositories',
    body: 'GitHub is connected and nothing has been read yet. A scan takes a few minutes and you can leave the page while it runs.',
    cta: 'Choose what to scan',
    href: '/student/github',
  },
  post_project: {
    eyebrow: 'You said you wanted this',
    headline: 'Post your project and find people to build it with',
    body: 'Describe what you are making and which skills you need. Applicants arrive with a record you can check rather than a list of claims.',
    cta: 'Post a project',
    href: '/listings/new',
  },
  find_work: {
    eyebrow: 'You said you wanted this',
    headline: 'Find a project to work on',
    body: 'Your record goes with every application, so a poster can see what you have actually built rather than take your word for it.',
    cta: 'Find work',
    href: '/listings',
  },
}

export default function NextStepCard({
  intents,
  githubConnected,
  repoCount,
  evidenceCount,
}: {
  intents: Intent[]
  githubConnected: boolean
  repoCount: number
  evidenceCount: number
}) {
  const step = nextStepFor({ intents, githubConnected, repoCount, evidenceCount })
  if (step === 'nothing') return null

  const copy = COPY[step]

  return (
    <Card focal style={{ marginBottom: 18 }}>
      <p style={{ fontSize: T.meta, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.accent, marginBottom: 7 }}>
        {copy.eyebrow}
      </p>
      <p style={{ fontFamily: F.display, fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em', color: C.text, lineHeight: 1.3, marginBottom: 7 }}>
        {copy.headline}
      </p>
      <p style={{ fontSize: T.bodySm, color: C.textMuted, lineHeight: 1.65, marginBottom: 17, maxWidth: '58ch' }}>
        {copy.body}
      </p>
      <Button href={copy.href} variant="accent">{copy.cta}</Button>
    </Card>
  )
}
