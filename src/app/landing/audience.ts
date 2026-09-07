/**
 * The two stories the marketing site tells, in one file.
 *
 * A student and a hiring manager want opposite things from this page. The
 * student wants to know what they get; the business wants to know why this
 * signal beats the one they already ignore. Saying both at once produces a
 * page that lands with neither, so the page has a switch and this is what it
 * switches between.
 *
 * Keeping both here rather than scattered through the components is
 * deliberate: the two columns should be readable against each other, because
 * the moment one side promises something the other contradicts, you can see
 * it.
 *
 * ── How this is written ─────────────────────────────────────────────────
 * Headings sell the payoff. "Calibrated across every record" describes a
 * mechanism; "Advanced means the same thing every time" is what the reader
 * actually gets from it, and it is the second one that makes somebody keep
 * reading. Bodies then say the plain version in two short sentences.
 *
 * The bodies are where the discipline goes. No em-dash clauses stacking a
 * third idea onto a sentence that already had two, no "which is to say", no
 * sentence that has to be read twice. If a line cannot be understood at a
 * glance it is not written yet.
 *
 * ── The honesty rule ────────────────────────────────────────────────────
 * Every step carries `now`. False means it is not built, and the page says
 * so on the card. Excitement is allowed; claiming an outcome we do not
 * deliver is not. "Stop applying" is a promise about the mechanism and
 * true. "Get hired" would be a promise about the result and is not ours to
 * make.
 */

export type Audience = 'students' | 'businesses'

export interface Step {
  n: string
  title: string
  body: string
  now: boolean
}

interface AudienceCopy {
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
  crossLink: { eyebrow: string; headline: string; body: string; cta: string }
}

export const COPY: Record<Audience, AudienceCopy> = {
  students: {
    tab: 'For students',
    // Not "For CS students" — the toggle two lines above already says that,
    // and a badge repeating the control next to it is a wasted line.
    eyebrow: 'Built at UMass Amherst',
    // The sentence every CS student has already said out loud. They do not
    // need to be sold the problem, so the headline skips straight to the
    // answer — and it sets up the whole page: the record answers
    // "experience", the externship answers "get", the marketplace answers
    // what happens next.
    headline: 'You need experience to get experience.',
    headlineAccent: 'Not any more.',
    lede:
      'The application system wants experience nobody ever gave you a chance to get. Workmark hands you the projects instead, then turns what you build into proof an employer can check.',
    primaryCta: { label: 'Start my first project', href: '/login' },
    secondaryCta: { label: 'See open projects', href: '/listings' },
    reassurance: 'Free with a .edu address. No CV, no cover letter, no waiting to hear back.',
    proof: [
      ['Start today, no application', 'Workmark writes you a project and you begin.'],
      ['You pick what we read', 'Repo by repo. Turn any of them off whenever.'],
      ['The record is yours', 'Download the whole thing in one file, any time.'],
    ],
    loopEyebrow: 'How it works',
    // Not "to signed offer". That promises a result Workmark does not
    // deliver, on the one page whose whole argument is that it does not
    // overstate. The arc is still the reward; it just stops where the
    // product does.
    loopHeadline: 'From side project to real work',
    loopLede: 'Four steps. You are already done with the first one.',
    steps: [
      {
        n: '01',
        title: 'Your side projects finally count for something',
        body:
          'Connect the repos you want read. Workmark works out what you built and how well, and gives every skill a level with the project behind it.',
        now: true,
      },
      {
        n: '02',
        title: 'Get an externship without applying for one',
        body:
          'Workmark writes you a real project aimed at the exact skill you are missing. Build it in your own repo and it lands on your record like any other work.',
        now: true,
      },
      {
        n: '03',
        title: 'Stop applying into the void',
        body:
          'Real projects from faculty, labs and student teams, matched to your record the moment they go up. You see your fit before you apply. They see your evidence before they reply.',
        now: true,
      },
      {
        n: '04',
        title: 'Then get paid for it',
        body:
          'Startups, small businesses and nonprofits hiring straight off the record. Paid projects first, internships next.',
        now: false,
      },
    ],
    crossLink: {
      eyebrow: 'Got work that needs doing?',
      headline: 'Find someone who can actually do it',
      body: 'Post a project free. Everyone who applies arrives with proof of what they have built.',
      cta: 'See it from that side',
    },
  },

  businesses: {
    tab: 'For businesses',
    eyebrow: 'For startups, SMBs, nonprofits and labs',
    headline: 'Stop reading CVs.',
    headlineAccent: 'Read the work.',
    lede:
      'A CV is a claim someone wrote about themselves. Workmark shows you what a candidate actually built, which project it came from, and how good it was.',
    primaryCta: { label: 'Post a project', href: '/listings/new' },
    secondaryCta: { label: 'See how the record works', href: '/how-it-works' },
    reassurance: 'Free to post. No contract. Nothing to install.',
    proof: [
      ['Proof, not adjectives', 'Every skill names the project behind it.'],
      ['Nobody grades themselves', 'Levels come from the code, not the candidate.'],
      ['You see the gaps too', 'Including what they cannot do yet.'],
    ],
    loopEyebrow: 'Why this beats a CV',
    loopHeadline: 'Know what they can do before you call them',
    loopLede: 'Everything below comes out of work that already exists.',
    steps: [
      {
        n: '01',
        title: 'Nobody can talk themselves up',
        body:
          'Skills are read out of the repositories a candidate owns: what the code depends on, who wrote which commits, whether it was tested. There is no box to exaggerate in.',
        now: true,
      },
      {
        n: '02',
        title: 'A weekend hack never outranks a real project',
        body:
          'How much of the work was theirs, how long they stayed with it, and how hard it was all change the level. Scale is part of the score, not a footnote.',
        now: true,
      },
      {
        n: '03',
        title: 'Advanced means the same thing every time',
        body:
          'Levels are set against every other record on the platform and move as more work comes in. Two candidates at the same level really are comparable.',
        now: true,
      },
      {
        n: '04',
        title: 'See how they work, not just what they shipped',
        body:
          'Did they hit their estimates? Flag problems early? Finish what they started? The things a reference call tries to find out, observed while the work happens.',
        now: false,
      },
    ],
    crossLink: {
      eyebrow: 'Looking for work instead?',
      headline: 'You need experience to get experience',
      body: 'Workmark hands you the projects, reads what you build, and turns it into proof an employer can check.',
      cta: 'See it from that side',
    },
  },
}
