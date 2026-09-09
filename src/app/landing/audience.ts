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
    // for, and a second badge under it was a line spent saying nothing.
    // MissionHero skips the badge when this is blank.
    eyebrow: '',
    // The sentence every CS student has already said out loud. They do not
    // need to be sold the problem, so the headline skips straight to the
    // answer — and it sets up the whole page: the record answers
    // "experience", the guided project answers "get", the marketplace
    // answers what happens next.
    headline: 'You need experience to get experience.',
    headlineAccent: 'Not any more.',
    // The lede is where the empathy goes, and it has to name the number
    // rather than gesture at it. Every student reading this has a real count
    // in their head. Saying it back is what makes them believe the rest.
    //
    // Then the reframe, immediately: it is not that they are not good
    // enough, it is that nothing in the process can tell. That is the honest
    // diagnosis and it is also what Workmark actually fixes.
    lede:
      'Two hundred applications. Four replies. Not because you cannot do the work. Because a CV gives nobody any way to tell. Workmark hands you real projects, reads the code you write, and turns it into proof somebody can check.',
    primaryCta: { label: 'Start my first project', href: '/login' },
    secondaryCta: { label: 'See open projects', href: '/listings' },
    reassurance: 'Free with a .edu address. No CV, no cover letter, no waiting to hear back.',
    proof: [
      ['Start today, no application', 'Workmark writes you a project and you begin.'],
      ['Stop waiting to hear back', 'Every week you spend applying, you can spend building something that counts.'],
      ['The record is yours', 'Download the whole thing in one file, any time.'],
    ],
    modesEyebrow: 'What you can do here',
    modesHeadline: 'Four ways in. None of them start with a CV.',
    // The line that separates Workmark from every job board: those are
    // waiting rooms. This is the one claim here that is emotionally true
    // AND true today, so it carries the section.
    modesLede:
      'Job boards were built for people who already have a career. Here you can work on the thing you are missing and go after real work at the same time.',
    modes: [
      {
        title: 'Get a guided project',
        body: 'The closest thing to a first job that does not require having had one. A brief, a board, deadlines, and someone senior breaking the work down. The difference is that the someone is Workmark, and nobody had to hire you. Aim it at a gap we spot, or name the skill you want to get better at and we will write it around that.',
        now: true,
      },
      {
        title: 'Get paid for real work',
        body: 'Research labs, startups and nonprofits post projects that pay. You see how well you fit before you spend an evening applying.',
        now: true,
      },
      {
        title: 'Build something with other students',
        body: 'Find people to build with, on your idea or theirs. Everyone on the project gets credit for the part they actually wrote.',
        now: true,
      },
      {
        // Said plainly, including the part most companies would hide: this
        // needs students here first. Being early is a reason to join, not
        // something to apologise for — and a reader who is told the
        // chicken-and-egg problem out loud believes the rest of the page.
        title: 'Get put in front of internships',
        body: 'The goal is to walk into a company and vouch for you by name. That takes a few hundred students with records strong enough to stand behind, so the earlier you build one, the earlier we can.',
        now: false,
      },
    ],
    loopEyebrow: 'How it works',
    // Not "to signed offer". That promises a result Workmark does not
    // deliver, on the one page whose whole argument is that it does not
    // overstate. The arc is still the reward; it just stops where the
    // product does.
    loopHeadline: 'From side project to real work',
    // The most reassuring true thing on the page. A student's biggest
    // private fear is that the semester they spent learning something did
    // not count for anything, because nothing ever asked them to prove it.
    loopLede:
      'Every hour you have already spent learning something counts here, and so does every hour you spend next. Four steps, and the first one is already behind you.',
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
        title: 'Get a guided project without applying for one',
        body:
          'Workmark writes you a real project aimed at the exact skill you are missing, then plans it with you like a senior dev would. Build it in your own repo and it lands on your record like any other work.',
        now: true,
      },
      {
        n: '03',
        title: 'Stop applying into the void',
        body:
          'Real projects from faculty, labs and student teams, matched to your record the moment they go up. You see your fit before you apply. They see your evidence before they reply. Nobody is filtered out by a keyword.',
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
    // Not "stop reading CVs" — that tells somebody what to do without
    // saying what is wrong, and nobody changes a process because a website
    // used the imperative. This states the problem they already have and
    // lets the fix be the short half.
    headline: 'Every CV says the same things.',
    headlineAccent: 'The work doesn’t.',
    // The pain named the way they actually experience it. Not "CVs are
    // vague" — that is the diagnosis. The felt problem is volume: the
    // qualified applications are in there somewhere and there is no way to
    // find them without reading all of it.
    lede:
      'Three hundred applications and no way to tell which four are worth an hour. Workmark shows you what somebody actually built, how good it was, and how they work, before you decide whether to reply.',
    primaryCta: { label: 'Post a project', href: '/listings/new' },
    secondaryCta: { label: 'See how the record works', href: '/how-it-works' },
    reassurance: 'Free to post. No contract. Nothing to install.',
    proof: [
      ['Read five, not three hundred', 'Only candidates whose record fits the role reach you.'],
      ['Nobody grades themselves', 'Skills come out of the code, not out of a text box.'],
      ['Try before you hire', 'Start with one real project. No contract, no headcount.'],
    ],
    modesEyebrow: 'Where the work comes from',
    modesHeadline: 'Four reasons a student is already building',
    // Two things a small employer needs to hear early. They are not
    // competing with a brand here, and if the skill they need is scarce,
    // the platform does something about it rather than shrugging.
    modesLede:
      'Nobody here is chasing a logo, so a ten-person company reads the same as a famous one. Every route below produces the same record, read the same way. Whichever door somebody came in through, the evidence is comparable.',
    modes: [
      {
        title: 'Guided projects',
        body: 'Workmark sets the brief against a skill gap, so the work was scoped by somebody other than the candidate. When a skill keeps going unfilled, that is the gap students get pointed at.',
        now: true,
      },
      {
        title: 'Paid project work',
        body: 'Real briefs from labs, startups and nonprofits, with a person on the other end who accepted the result.',
        now: true,
      },
      {
        title: 'Student teams',
        body: 'Several people, one repository, contributions attributed by commit author. You see what each of them did.',
        now: true,
      },
      {
        title: 'Internship placement',
        body: 'Candidates put in front of you because their record supports it, not because they found your posting.',
        now: false,
      },
    ],
    loopEyebrow: 'A signal that did not exist',
    loopHeadline: 'Know what they can do, and how they work, before you call them',
    // Two halves, and the second is the one nobody else has. A reference
    // call exists to find out whether somebody finishes things and says so
    // when they are slipping. That is observed here rather than asked about.
    loopLede:
      'Not a better-formatted CV. Verified technical evidence, plus the things a reference call tries to get at and usually cannot.',
    steps: [
      {
        n: '01',
        title: 'The pile sorts itself',
        body:
          'Candidates are matched against what the role actually needs before they ever reach you. You read a handful of records that fit instead of screening out the rest by hand.',
        now: true,
      },
      {
        n: '02',
        title: 'Nobody can talk themselves up',
        body:
          'Skills are read out of the repositories a candidate owns: what the code depends on, who wrote which commits, whether it was tested. There is no box to exaggerate in. A weekend hack never outranks a real project.',
        now: true,
      },
      {
        n: '03',
        title: 'See how they work, not just what they shipped',
        body:
          'Did they hit their estimates? Flag problems early? Finish what they started? Measured while the work happened, from a board they were using anyway.',
        now: true,
      },
      {
        n: '04',
        title: 'Find out before you commit to anything',
        body:
          'Post one real project and work with somebody on it. A few weeks of actual output tells you more than any interview, and nobody has to be hired to find out.',
        now: true,
      },
    ],
    crossLink: {
      eyebrow: 'Looking for work instead?',
      headline: 'You need experience to get experience',
      body: 'Sending applications into the void does not work. Workmark hands you the projects instead, reads what you build, and turns it into proof somebody can check.',
      cta: 'See it from that side',
    },
  },
}
