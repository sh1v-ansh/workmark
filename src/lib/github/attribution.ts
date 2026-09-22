// Deciding which commits in a repository are the student's.
//
// ── What was wrong ────────────────────────────────────────────────────────
// The scanner asked GitHub the question: listCommits({ author: login }).
// GitHub answers that by matching the commit's author email against the
// emails *verified on that account*. Anything else is not theirs as far as
// the API is concerned.
//
// So a student who committed from a lab machine, or with their university
// address, or before they added that address to GitHub, or with git's
// default `user@hostname`, got zero commits — and therefore zero evidence
// from a repository they wrote every line of. The scan reported success.
// That is the worst possible failure for this product: silent, total, and
// indistinguishable from "you have not done anything".
//
// ── What replaces it ──────────────────────────────────────────────────────
// Read every commit and decide here, on three signals:
//
//   1. GitHub attributed it to their account. Strongest — GitHub verified
//      the email against the account, and we keep taking its word for it.
//   2. The author email is one they have confirmed is theirs.
//   3. A Co-Authored-By trailer carries an email they have confirmed.
//      Pair programming and squash merges both land here, and both were
//      completely invisible before.
//
// ── The rule that stops this being a way to steal work ────────────────────
// An email is only offered to a student to claim when GitHub has not already
// attributed its commits to some other account. If GitHub says a commit
// belongs to @someone-else, no amount of claiming makes it yours. What is
// left over is the genuinely unattributed case — a local git config nobody
// ever linked — which is exactly the case worth asking about and the only
// one where a human answer adds anything.

/** One commit, flattened to the fields attribution actually looks at. */
export interface CommitIdentity {
  sha: string
  /** The GitHub account GitHub matched, or null when it matched nobody. */
  authorLogin: string | null
  authorEmail: string | null
  authorName: string | null
  /** Full message, read for Co-Authored-By trailers. */
  message: string | null
  /** Author date, ISO. Used for active days and span, not for attribution. */
  date?: string | null
}

export interface StudentIdentity {
  login: string
  /** Lowercased emails the student has confirmed are theirs. */
  emails: Set<string>
}

/** An email seen on commits that is not yet known to be anybody's. */
export interface UnclaimedEmail {
  email: string
  /** The name git had configured alongside it, for recognisability. */
  name: string | null
  commits: number
  /**
   * False when GitHub already attributes these commits to a different
   * account. Those are somebody else's and are never offered.
   */
  claimable: boolean
}

function normalizeEmail(value: string | null | undefined): string | null {
  const v = value?.trim().toLowerCase()
  return v ? v : null
}

/**
 * GitHub's per-account privacy address.
 *
 * Commits made through the web UI use it. It is always attributed by login
 * anyway, so it never needs claiming, and offering it would be offering
 * somebody an address that is by construction already handled.
 */
const NOREPLY = /@users\.noreply\.github\.com$/i

/** Co-Authored-By: Full Name <email@example.com> */
const COAUTHOR = /^\s*co-authored-by:\s*(?:.*?)\s*<([^>]+)>\s*$/gim

export function coAuthorEmails(message: string | null): string[] {
  if (!message) return []
  const out: string[] = []
  // exec in a loop rather than matchAll, because lastIndex on a module-level
  // regex with /g is state that survives calls — reset it explicitly.
  COAUTHOR.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = COAUTHOR.exec(message)) !== null) {
    const email = normalizeEmail(m[1])
    if (email) out.push(email)
  }
  return out
}

export interface Attribution {
  /** Commits this student wrote or co-wrote. */
  mine: CommitIdentity[]
  /**
   * Addresses worth asking about, commonest first. Empty in the ordinary
   * case where everything was already attributed.
   */
  unclaimed: UnclaimedEmail[]
}

/**
 * Split a repository's commits into theirs and everything else.
 *
 * Deliberately pure and deliberately separate from the API call. Which
 * commits belong to whom is the single most consequential judgement the
 * scanner makes — it decides whether a student has a record at all — and it
 * should be readable, testable and arguable without a network.
 */
export function attributeCommits(
  commits: CommitIdentity[],
  identity: StudentIdentity,
): Attribution {
  const login = identity.login.toLowerCase()
  const mine: CommitIdentity[] = []

  // email -> what we know about it
  const unknown = new Map<string, { name: string | null; commits: number; otherLogin: boolean }>()

  for (const c of commits) {
    const email = normalizeEmail(c.authorEmail)
    const byLogin = c.authorLogin?.toLowerCase() === login
    const byEmail = email !== null && identity.emails.has(email)
    const byTrailer = coAuthorEmails(c.message).some((e) => identity.emails.has(e))

    if (byLogin || byEmail || byTrailer) {
      mine.push(c)
      continue
    }

    // Not theirs on any signal. Worth asking about only if nobody else owns
    // it and it is not GitHub's own privacy address.
    if (!email || NOREPLY.test(email)) continue
    const seen = unknown.get(email) ?? { name: c.authorName, commits: 0, otherLogin: false }
    seen.commits += 1
    // Once GitHub has attributed this address to any account at all, it is
    // that account's, and the question is closed.
    if (c.authorLogin) seen.otherLogin = true
    unknown.set(email, seen)
  }

  const unclaimed: UnclaimedEmail[] = Array.from(unknown.entries())
    .map(([email, v]) => ({ email, name: v.name, commits: v.commits, claimable: !v.otherLogin }))
    .filter((u) => u.claimable)
    .sort((a, b) => b.commits - a.commits)

  return { mine, unclaimed }
}

/**
 * Whether it is worth telling the student we found nothing of theirs.
 *
 * A repository with commits in it, none of which we could attribute, is the
 * signature of the bug this module exists for — and the message it produces
 * ("we read it, but found no commits of yours") is one a student reads as
 * "Workmark thinks I did nothing". If there is an address they could claim,
 * they should be asked rather than told.
 */
export function shouldAskAboutEmails(a: Attribution): boolean {
  return a.mine.length === 0 && a.unclaimed.length > 0
}

/**
 * Which commits to fetch file-level detail for.
 *
 * ── Why not just the newest ───────────────────────────────────────────────
 * It used to be `commits.slice(0, 20)`. Everything the scanner knows about
 * what a student actually writes — which files they touch, which languages
 * they use, which libraries they import — came from their twenty most recent
 * commits.
 *
 * On a year-long project whose last fortnight was README edits, dependency
 * bumps and config, that produces an empty language share. Every language
 * relevance then collapses to the "in the repo, but not in files you
 * changed" branch, falls below the evidence bar, and the student gets no
 * evidence at all for the language they wrote the whole thing in. The
 * shape of a record was decided by what somebody happened to be doing last
 * week.
 *
 * Spreading the sample across the whole history costs exactly the same
 * number of requests and describes the project rather than its most recent
 * fortnight.
 *
 * ── Why it has to be deterministic ────────────────────────────────────────
 * Two scans of an unchanged repository must produce the same record. An
 * evenly spaced walk does that; anything random or time-dependent means a
 * student's level can move because they pressed rescan.
 */
export function sampleAcross<T>(items: T[], limit: number): T[] {
  if (limit <= 0) return []
  if (items.length <= limit) return items

  const out: T[] = []
  const step = items.length / limit
  for (let i = 0; i < limit; i++) {
    out.push(items[Math.floor(i * step)])
  }
  return out
}
