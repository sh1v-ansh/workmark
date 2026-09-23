// What a student says they came here for.
//
// ── Why this screen exists ────────────────────────────────────────────────
// Almost everybody arrives believing Workmark is one thing: it reads your
// code and gives you a record. That is the half we lead with everywhere, so
// it is the half they know about — and a student who never learns the other
// three never posts a project, never joins one, and never starts a guided
// build. The features exist and nobody meets them.
//
// The obvious answer is a tour. Tours are the thing everybody builds and
// nobody reads. A choice is different: picking something is how you find out
// it was on offer, it takes one screen, and unlike a tour it leaves behind
// an answer worth acting on.
//
// ── Why it has to change something ────────────────────────────────────────
// A question whose answer is stored and ignored is worse than no question —
// it teaches people that what they tell us does not matter. So this orders
// the dashboard, and the first card somebody sees is the thing they said
// they wanted.

export const INTENTS = {
  build_record: {
    label: 'Turn code I have already written into a record',
    detail: 'Workmark reads the repositories you choose and works out what you can actually build.',
  },
  join_project: {
    label: 'Work on a project with other students',
    detail: 'Apply to projects other students and faculty have posted, with your record attached.',
  },
  post_project: {
    label: 'Post my own project and find people to build it with',
    detail: 'Describe what you are making and say which skills you need. Applicants arrive with proof.',
  },
  guided_project: {
    label: 'Be given a project to build',
    detail: 'If you have not got much to show yet, Workmark writes you a project and takes you through it a task at a time.',
  },
} as const

export type Intent = keyof typeof INTENTS

export const INTENT_ORDER = Object.keys(INTENTS) as Intent[]

export function isIntent(value: unknown): value is Intent {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(INTENTS, value)
}

/** Drop anything unrecognised rather than refusing the whole answer. */
export function cleanIntents(raw: unknown): Intent[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<Intent>()
  for (const value of raw) if (isIntent(value)) seen.add(value)
  return INTENT_ORDER.filter((i) => seen.has(i))
}

/**
 * Where to send somebody first, given what they said and what they have.
 *
 * ── The freshman case ─────────────────────────────────────────────────────
 * A first-year with an empty GitHub is a large share of the people waiting
 * for this, and the worst thing the product can do is read their empty
 * account, find nothing, and show them a record with nothing in it. That is
 * technically accurate and lands as a verdict on somebody who has not had
 * the chance to do anything yet.
 *
 * So an empty GitHub beats every stated intent. Whatever they picked, the
 * honest first move for somebody with nothing to scan is a project to build
 * — and having something to show is a precondition for the other three
 * anyway.
 */
export interface NextStepInput {
  intents: Intent[]
  githubConnected: boolean
  /** Repositories Workmark is allowed to read. */
  repoCount: number
  /** Skills actually on their record. */
  evidenceCount: number
  /** Listed in the student directory, so others looking for collaborators
   *  can find them. Omitted means unknown, which is treated as yes. */
  openToCollab?: boolean
  /** Projects they have posted. */
  postedCount?: number
}

export type NextStep =
  | 'connect_github'
  | 'start_guided_project'
  | 'scan'
  | 'be_discoverable'
  | 'post_project'
  | 'find_work'
  | 'nothing'

export function nextStepFor(input: NextStepInput): NextStep {
  if (!input.githubConnected) return 'connect_github'

  // Connected, and there is genuinely nothing there. Not a failure state —
  // it is most first-years, and it is the case the guided projects feature
  // was built for.
  if (input.repoCount === 0) return 'start_guided_project'

  // Repositories but nothing on the record yet: the scan has not run, or ran
  // and found nothing of theirs.
  if (input.evidenceCount === 0) {
    return input.intents.includes('guided_project') ? 'start_guided_project' : 'scan'
  }

  // They have a record. Now what they said they wanted decides.
  // Anyone here for collaboration is first asked to be findable. Posting a
  // project reaches the people who go looking; being in the directory
  // reaches the ones who don't. It is also one click, where posting is a form.
  const wantsPeople = input.intents.includes('post_project') || input.intents.includes('join_project')
  if (wantsPeople && input.openToCollab === false) return 'be_discoverable'

  // Only until they have posted one. It kept asking after the project was
  // up, which read as though the first one had not worked.
  if (input.intents.includes('post_project') && (input.postedCount ?? 0) === 0) return 'post_project'
  if (input.intents.includes('join_project')) return 'find_work'
  if (input.intents.includes('guided_project')) return 'start_guided_project'
  return 'nothing'
}
