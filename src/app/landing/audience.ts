/**
 * Every word on the marketing site, in one file.
 *
 * The home page speaks to two readers at once: students looking for
 * opportunities, and employers deciding who to screen. HOME is that page.
 * COPY is the per-audience version the /how-it-works page switches between.
 * Both live here so the two can be read against each other, and a promise
 * made on one side can be checked against the other.
 *
 * ── How this is written ─────────────────────────────────────────────────
 * People read the headings and skip the paragraphs. So every heading says
 * exactly what its section offers, and a reader who sees only the headings
 * should understand the whole product. Bodies are one to three short
 * sentences, second person, active voice.
 *
 * No em dashes, no metaphors, no buzzwords. Only features we describe to
 * users elsewhere; no invented numbers, names or logos. "Verified work
 * history" or "verified profile", never "background-checked".
 */

export type Audience = 'students' | 'businesses'

export interface Step {
  n: string
  title: string
  body: string
  now: boolean
}

/** One block in a "for students" or "for employers" list. */
export interface Mode {
  title: string
  body: string
  now: boolean
}

export interface ModesSection {
  id: string
  eyebrow: string
  headline: string
  lede: string
  modes: Mode[]
}

// PLACEHOLDER: there is no employer sign-up yet, so "Hire through Workmark"
// opens an email. Swap this for a form or an employer sign-up page when one
// exists.
const HIRE_HREF = 'mailto:support@workmark.org?subject=Hiring%20through%20Workmark'

const STUDENT_STEPS: Step[] = [
  {
    n: '01',
    title: 'Connect GitHub and get a verified profile',
    body: 'Pick the repositories you want us to read. Workmark turns your code into a profile with a proficiency level for each skill.',
    now: true,
  },
  {
    n: '02',
    title: 'Choose paid work, a team project or a guided project',
    body: 'Apply to projects that fit you, or start a guided project and build new skills with your AI mentor.',
    now: true,
  },
  {
    n: '03',
    title: 'Mark yourself open to work',
    body: 'Your verified profile applies to roles that fit you. We send you hackathons, fellowships and internships that match your skill level.',
    now: true,
  },
]

const EMPLOYER_STEPS: Step[] = [
  {
    n: '01',
    title: 'Tell us the skills and level you are hiring for',
    body: 'Describe the role in a few lines. We match it against candidates who are open to work.',
    now: true,
  },
  {
    n: '02',
    title: 'Review candidates with verified work',
    body: 'See deployed projects, a proficiency level for each skill, and work confirmed by the people who supervised it.',
    now: true,
  },
  {
    n: '03',
    title: 'Start with a paid project or go to interviews',
    body: 'Test a candidate on real work first, or use what you saw to decide who moves on to your OA and interviews.',
    now: true,
  },
]

/** The home page: both audiences, top to bottom. */
export const HOME = {
  hero: {
    headline: 'Students show what they can do.',
    headlineAccent: 'Employers see it before the interview.',
    lede: 'Students find paid work, team projects and guided projects in one place, and every project adds to a verified profile. Employers use that profile to decide who to screen.',
    studentCta: { label: 'Join as a student', href: '/login' },
    employerCta: { label: 'Hire through Workmark', href: HIRE_HREF },
    reassurance: 'Free for students with a .edu email.',
  },

  students: {
    id: 'students',
    eyebrow: 'For students',
    headline: 'Find paid work, team projects and internships in one place',
    lede: 'Everything you build and everything you apply for lives on one verified profile.',
    modes: [
      {
        title: 'Get paid for real projects',
        body: 'Labs, startups and nonprofits post paid projects. You see how well you fit before you apply.',
        now: true,
      },
      {
        title: 'Build projects with other students',
        body: 'Join a team on someone else’s idea, or bring your own and find people to build it with. Everyone gets credit for the part they wrote.',
        now: true,
      },
      {
        title: 'Learn with a guided project and an AI mentor',
        body: 'Get a project that matches your skill level, split into tasks in your own workspace. Your AI mentor reviews your work and helps when you get stuck.',
        now: true,
      },
      {
        title: 'Get hackathons, fellowships and internships picked for you',
        body: 'We send you recommendations based on your skills and your skill level, so you spend less time searching.',
        now: true,
      },
      {
        title: 'Let your verified profile apply for you',
        body: 'Mark yourself open to work. Your profile applies to roles that fit you.',
        now: true,
      },
    ],
  } satisfies ModesSection,

  employers: {
    id: 'employers',
    eyebrow: 'For employers',
    headline: 'Screen candidates by verified work before OAs and interviews',
    lede: 'Workmark comes before your online assessments and interviews. You decide who to screen with far more information than a resume or LinkedIn profile gives you.',
    modes: [
      {
        title: 'See verified work before you interview',
        body: 'Every candidate has a verified work history built from projects they actually did.',
        now: true,
      },
      {
        title: 'See deployed projects and a level for every skill',
        body: 'Profiles show deployed projects and a proficiency level for each skill, with the work behind it.',
        now: true,
      },
      {
        title: 'See work confirmed by the people who supervised it',
        body: 'Work records are confirmed by the faculty or employers who oversaw the project.',
        now: true,
      },
      {
        title: 'Only see candidates who are open to work',
        body: 'Every candidate has opted in. You never chase someone who is not looking.',
        now: true,
      },
      {
        title: 'Start with a paid project before you hire',
        body: 'Give a candidate a short paid project and see their real output before you make an offer.',
        now: true,
      },
      {
        title: 'Find strong candidates beyond the usual target schools',
        body: 'Profiles are judged on the work, so strong candidates from any school show up next to the ones you already know.',
        now: true,
      },
    ],
  } satisfies ModesSection,

  howItWorks: {
    eyebrow: 'How it works',
    headline: 'How students find opportunities and employers find candidates',
    lede: 'Students build a verified profile once. Employers use it to decide who to talk to.',
    students: { label: 'For students', steps: STUDENT_STEPS },
    employers: { label: 'For employers', steps: EMPLOYER_STEPS },
  },

  closing: {
    headline: 'Get a verified profile, or find candidates who have one',
    body: 'Students join free with a .edu email. Employers, tell us what you are hiring for and we will get you set up.',
  },
}

interface AudienceCopy {
  tab: string
  primaryCta: { label: string; href: string }
  loopEyebrow: string
  loopHeadline: string
  loopLede: string
  steps: Step[]
}

/** Per-audience copy, for /how-it-works and its toggle. */
export const COPY: Record<Audience, AudienceCopy> = {
  students: {
    tab: 'For students',
    primaryCta: HOME.hero.studentCta,
    loopEyebrow: 'How it works for students',
    loopHeadline: 'Get a verified profile, then let it find you work',
    loopLede: 'Three steps. Your profile grows with every project you finish.',
    steps: STUDENT_STEPS,
  },
  businesses: {
    tab: 'For employers',
    primaryCta: HOME.hero.employerCta,
    loopEyebrow: 'How it works for employers',
    loopHeadline: 'Decide who to screen using verified work',
    loopLede: 'Three steps, and every candidate you see has opted in as open to work.',
    steps: EMPLOYER_STEPS,
  },
}
