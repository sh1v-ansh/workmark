/**
 * The two stories the marketing site tells, in one file.
 *
 * A student and a hiring manager want opposite things from this page. The
 * student wants to know what they get; the business wants to know why the
 * signal is better than the one they already ignore. Trying to say both at
 * once produces a page that says neither, so the page has a switch and this
 * is what it switches between.
 *
 * Keeping both here rather than scattered through the components is
 * deliberate: the two columns should be readable against each other, because
 * the moment one side starts promising something the other side contradicts,
 * you can see it.
 *
 * ── The honesty rule ────────────────────────────────────────────────────
 * Every step carries `now`. False means it is not built, and the page says
 * so on the card rather than in a footnote. Paid placements, interview
 * routing and internships are all on the far side of that line today, and
 * a landing page for a product about verifiable claims cannot make
 * unverifiable ones about itself.
 */

export type Audience = 'students' | 'businesses'

export interface Step {
  n: string
  title: string
  body: string
  now: boolean
}

interface AudienceCopy {
  /** Label on the switch. */
  tab: string
  eyebrow: string
  headline: string
  headlineAccent: string
  lede: string
  primaryCta: { label: string; href: string }
  secondaryCta: { label: string; href: string }
  reassurance: string
  proof: [string, string][]
  loopEyebrow: string
  loopHeadline: string
  loopLede: string
  steps: Step[]
  /** The band that points at the other audience. */
  crossLink: { eyebrow: string; headline: string; body: string; cta: string }
}

export const COPY: Record<Audience, AudienceCopy> = {
  students: {
    tab: 'For students',
    eyebrow: 'For CS students',
    headline: 'Don’t just tell people what you can do.',
    headlineAccent: 'Prove it.',
    lede:
      'The job application has not changed in thirty years and everyone knows it is broken. Workmark replaces it with a record of work you actually did — read from your own code, checkable line by line, and built up every time you finish something.',
    primaryCta: { label: 'Build my record', href: '/login' },
    secondaryCta: { label: 'See open projects', href: '/listings' },
    reassurance: 'Takes about two minutes. No CV, no cover letter.',
    proof: [
      ['Free while you are a student', 'A .edu address is all it takes.'],
      ['You choose what we read', 'Repository by repository, revocable at any time.'],
      ['Your record, exportable', 'One file, whenever you want it, no asking.'],
    ],
    loopEyebrow: 'How it works',
    loopHeadline: 'Do real work. Build evidence of it. Let the evidence open the door.',
    loopLede:
      'That is the whole idea, and the order matters — the record is a by-product of doing something, not a form you fill in.',
    steps: [
      {
        n: '01',
        title: 'Start with the code you have already written',
        body:
          'Pick the repositories. Workmark reads what they depend on, how they are built and which commits are yours, and turns that into skills at a level — each one with the project behind it.',
        now: true,
      },
      {
        n: '02',
        title: 'Get real experience, with a person or on your own',
        body:
          'Apply to projects posted by faculty, labs and student teams — real work for someone who needs it. When nothing open fits, Workmark writes you a project that closes the gap between what you can prove and what people keep asking for.',
        now: true,
      },
      {
        n: '03',
        title: 'Let the work find you',
        body:
          'Your record is matched against every project as it is posted, so the fit is worked out before you apply and you can see where you fall short. No cover letter about your passion for teamwork.',
        now: true,
      },
      {
        n: '04',
        title: 'Paid work, and a route into internships',
        body:
          'Startups, small businesses and nonprofits hiring from the record rather than from a CV pile — paid engagements first, then internships, matched on evidence you have already produced.',
        now: false,
      },
    ],
    crossLink: {
      eyebrow: 'If you have work that needs doing',
      headline: 'Post a project and see who can actually do it',
      body:
        'For faculty, labs, startups, small businesses and nonprofits. Applicants arrive with a record you can inspect rather than a page of adjectives.',
      cta: 'See it from that side',
    },
  },

  businesses: {
    tab: 'For businesses',
    eyebrow: 'For startups, SMBs, nonprofits and labs',
    headline: 'Stop reading CVs.',
    headlineAccent: 'Read the work.',
    lede:
      'A CV is a claim about a person, written by that person, with nothing behind it. Workmark gives you a record built from code they actually shipped — every skill at a level, with the project it came from and how it was checked attached to it.',
    primaryCta: { label: 'Post a project', href: '/listings/new' },
    secondaryCta: { label: 'See how the record works', href: '/how-it-works' },
    reassurance: 'Free to post. No contract, nothing to install.',
    proof: [
      ['Evidence, not adjectives', 'Every skill names the project it came from.'],
      ['Calibrated, not self-scored', 'Levels are set against every other record on the platform.'],
      ['You see the gaps too', 'Including what an applicant cannot do yet.'],
    ],
    loopEyebrow: 'Why the signal is better',
    loopHeadline: 'A measured signal, not a self-reported one',
    loopLede:
      'Everything below is derived from work that already exists. None of it is a student telling us how good they are.',
    steps: [
      {
        n: '01',
        title: 'Read from the work, not from a form',
        body:
          'Skills come out of dependency graphs, build configuration, commit authorship and test coverage in repositories the student owns. Nobody types "proficient in PostgreSQL" into anything.',
        now: true,
      },
      {
        n: '02',
        title: 'Weighted by what the work actually took',
        body:
          'A skill used once in a weekend project and one carried through months of a multi-contributor codebase are not the same claim, and are not scored as though they were.',
        now: true,
      },
      {
        n: '03',
        title: 'Calibrated across every record',
        body:
          'Levels are set against the whole platform rather than against a rubric someone wrote once, and recalibrated as more work comes in. Advanced means something specific and comparable.',
        now: true,
      },
      {
        n: '04',
        title: 'Evidence from how they work, not only what they shipped',
        body:
          'A shared workspace for projects run through Workmark — estimates against actuals, blockers raised early, commitments met. The things a reference call is trying to find out, observed instead of asked about.',
        now: false,
      },
    ],
    crossLink: {
      eyebrow: 'If you are the one being hired',
      headline: 'Build a record instead of another CV',
      body:
        'Workmark reads the code you have already written and turns it into something an employer can check, then finds you work that uses it.',
      cta: 'See it from that side',
    },
  },
}
