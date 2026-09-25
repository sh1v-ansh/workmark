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

/**
 * The ways to use Workmark.
 *
 * The page read as one product — get evidence — and that is the reason to
 * sign up, not the reason to come back next month. These are the reasons to
 * come back.
 *
 * `now` matters more here than anywhere else on the page. Three of these
 * exist and one does not, and the honest label on the fourth is what makes
 * the first three believable. A page listing four things a reader can only
 * verify three of teaches them to discount all four.
 */
export interface Mode {
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
  modesEyebrow: string
  modesHeadline: string
  modesLede: string
  modes: Mode[]
  loopEyebrow: string
  loopHeadline: string
  loopLede: string
  steps: Step[]
  crossLink: { eyebrow: string; headline: string; body: string; cta: string }
}

export const COPY: Record<Audience, AudienceCopy> = {
  students: {
    tab: 'For students',
    // Empty on purpose. The toggle directly above already says who this is
    // for. MissionHero skips the badge when this is blank.
    eyebrow: '',
    headline: 'Build real projects, find paid work,',
    headlineAccent: 'and get opportunities picked for you.',
    lede:
      'Do guided projects alone or with other students, start a student business with people you meet here, and find paid work at local companies. Everything you build goes on a verified profile, and we send you opportunities that fit it.',
    primaryCta: { label: 'Start my first project', href: '/login' },
    secondaryCta: { label: 'See open projects', href: '/listings' },
    reassurance: 'Free with a .edu email. Turn on open to work when you want us to consider you for roles.',
    proof: [
      ['Guided projects, solo or with a team', 'Start today. No application needed.'],
      ['Paid work at local companies', 'Matched to your verified profile.'],
      ['Opportunities sent to you', 'Hackathons, fellowships, internships, events and conferences.'],
    ],
    modesEyebrow: 'What you can do here',
    modesHeadline: 'Projects, paid work and opportunities in one place',
    modesLede:
      'Pick what fits your week. Everything you do here adds to the same verified profile.',
    modes: [
      {
        title: 'Do a guided project, solo or with other students',
        body: 'Get a project matched to your skill level and build it in your own workspace. An AI tech lead plans the work with you and checks each task.',
        now: true,
      },
      {
        title: 'Start a student business with people you meet here',
        body: 'Find students with the skills your idea needs, or join someone else’s. Everyone gets credit for the part they built.',
        now: true,
      },
      {
        title: 'Find paid work at local companies',
        body: 'Local companies post paid projects and see your verified profile, so you are judged on what you have built.',
        now: true,
      },
      {
        title: 'Get hackathons, fellowships and internships sent to you',
        body: 'We send you hackathons, fellowships, internships, events, conferences and more that match your skills and your level.',
        now: true,
      },
      {
        title: 'Turn on open to work to be considered for roles',
        body: 'We only put you forward for roles when you say so. Switch it on or off any time.',
        now: true,
      },
    ],
    loopEyebrow: 'How it works',
    loopHeadline: 'From your first project to paid work',
    loopLede: 'Four steps. You can start the first one today.',
    steps: [
      {
        n: '01',
        title: 'Connect GitHub and get a verified profile',
        body: 'Pick the repositories you want us to read. We turn your code into a profile with a level for each skill.',
        now: true,
      },
      {
        n: '02',
        title: 'Build a guided project, solo or with a team',
        body: 'Get a project at your level and build it with an AI tech lead. It adds to your profile like any other work.',
        now: true,
      },
      {
        n: '03',
        title: 'Get opportunities picked for your level',
        body: 'We send you hackathons, fellowships, internships, events and conferences that fit what you can do.',
        now: true,
      },
      {
        n: '04',
        title: 'Turn on open to work and get considered for paid roles',
        body: 'Local companies see your verified profile. We only put you forward when your open to work setting is on.',
        now: true,
      },
    ],
    crossLink: {
      eyebrow: 'Hiring?',
      headline: 'Screen candidates by verified work before interviews',
      body: 'Every candidate has a verified work history and has opted in as open to work.',
      cta: 'See the employer side',
    },
  },

  businesses: {
    tab: 'For businesses',
    eyebrow: 'For startups, SMBs, nonprofits and labs',
    headline: 'Stop hiring from AI-written resumes.',
    headlineAccent: 'See what candidates actually built.',
    lede:
      'Every entry-level CS candidate on Workmark has a record of real work, read from their code and confirmed by the people who supervised it. Know who is worth screening before you send a single OA.',
    primaryCta: { label: 'Post a project', href: '/listings/new' },
    secondaryCta: { label: 'See a verified profile', href: '/how-it-works' },
    reassurance: 'Free to post. Every candidate has opted in as open to work.',
    proof: [
      ['Evidence, not claims', 'Every skill links to the work that proves it.'],
      ['Qualified applicants only', 'Candidates who do not fit the role cannot apply.'],
      ['Try before you hire', 'Start with a paid project and see real output.'],
    ],
    modesEyebrow: 'Why resumes stopped working',
    modesHeadline: 'AI made every resume look perfect. Real work is harder to fake.',
    modesLede:
      'Candidates tailor a resume to your job post in seconds, so the pile looks qualified and tells you nothing. Referrals still work, but most great early-career engineers do not have a network yet. So you miss them, and they miss you.',
    modes: [
      {
        title: 'Real work on the record',
        body: 'Every project has a real scope, a deadline and a result you can open and check.',
        now: true,
      },
      {
        title: 'A referral from the people who were there',
        body: 'Professors and managers vouch for the work they supervised, and every vouch is tied to a verified project. The trust of a referral, without needing to know the person.',
        now: true,
      },
      {
        title: 'Skill depth, not buzzwords',
        body: '“Knows React” means something specific: a level built from their own code and deployed projects.',
        now: true,
      },
      {
        title: 'See who uses AI well',
        body: 'Every student uses AI now. You see who gets real work done with it and catches what it gets wrong.',
        now: true,
      },
    ],
    loopEyebrow: 'How it works',
    loopHeadline: 'Your filter before the OA',
    loopLede: 'A short list of people whose work already fits, instead of a thousand lookalike applications.',
    steps: [
      {
        n: '01',
        title: 'Describe the real work',
        body: 'A feature, a tool or a problem to solve. Clear work attracts the right people and filters out the rest.',
        now: true,
      },
      {
        n: '02',
        title: 'See matches ranked by verified work',
        body: 'Ranked by clear, repeatable scoring on what they built, not by AI guessing from keywords.',
        now: true,
      },
      {
        n: '03',
        title: 'Screen only people worth your time',
        body: 'Send OAs and interviews to candidates who already fit. Fewer bad screens for you, fewer ghosted applications for them.',
        now: true,
      },
      {
        n: '04',
        title: 'Hire, or start with a paid project',
        body: 'Try someone on real work before you commit.',
        now: true,
      },
    ],
    crossLink: {
      eyebrow: 'Looking for work instead?',
      headline: 'Get guided projects, paid work and opportunities as a student',
      body: 'Build projects alone or with other students, and get hackathons, fellowships and internships sent to you.',
      cta: 'See the student side',
    },
  },
}
