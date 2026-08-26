// Which of a student's repos are worth scanning by default.
//
// Every public repo used to be switched on automatically. A student with
// 300 of them queued 300 scan steps — roughly 15,000 GitHub requests against
// a limit of about 5,000 an hour, so the scan ran for hours and got
// rate-limited partway through.
//
// A cap here isn't giving up on accuracy. The depth calculation already
// sorts a skill's evidence strongest-first and makes each one after that
// count for less, so by the twentieth repo demonstrating React the twentieth
// moves the number by almost nothing. Scanning it costs real money and real
// time for no change to the record. The cap stops paying for that.
//
// Everything here is computed from the repo listing we already fetch. No
// extra API calls — if ranking cost a request per repo, ranking 300 repos
// would cost 300 requests and we'd have solved nothing.

export interface RankableRepo {
  repoFullName: string
  isPrivate: boolean
  isFork: boolean | null
  isArchived: boolean | null
  sizeKb: number | null
  pushedAt: string | null
  createdAtGh: string | null
  description: string | null
  primaryLanguage: string | null
  stars: number | null
  hasPages: boolean | null
  /** The student's explicit word, which outranks any score. */
  scanChoice: 'on' | 'off' | null
  /** True when a project brief points at this repo — they told us it's theirs. */
  linkedToBrief?: boolean
}

export interface RankedRepo extends RankableRepo {
  score: number
  /** Plain-language explanation, shown next to the repo in the picker. */
  reason: string
  enabled: boolean
}

/** How many repos get switched on by default. */
export const DEFAULT_SCAN_LIMIT = 25

/**
 * Nobody gets fewer than this, whatever the scores say. A first-year with
 * three small recent repos scoring below every bar is exactly the person
 * this product is for, and "we scanned none of your work" is the worst
 * possible outcome for them.
 */
export const MINIMUM_ENABLED = 5

/**
 * Score one repo. Higher is more worth reading.
 *
 * Weights are deliberately coarse. This decides what gets *looked at*, not
 * what anything is worth — a repo that ranks low and gets scanned anyway
 * scores exactly the same as it would have. That makes precision here much
 * less important than it is in the difficulty composite.
 */
export function scoreRepo(repo: RankableRepo, now: Date = new Date()): { score: number; reason: string } {
  // A fork is usually someone else's work. Undiverged ones are skipped by
  // the scan anyway, but that check costs a request — better not to spend it.
  if (repo.isFork) return { score: -10, reason: 'this is a fork' }
  if (repo.isArchived) return { score: -5, reason: 'archived' }

  let score = 0
  const notes: string[] = []

  // How long the project ran. The strongest free signal here: a repo created
  // and last pushed on the same afternoon is one sitting; one worked on
  // across weeks is something they kept returning to.
  //
  // Read off GitHub's timestamps, which a stray bot commit can inflate — the
  // scan computes a bot-proof version from the student's own commits, but
  // that needs a request per repo and this has to stay free.
  const lifespanDays = repo.createdAtGh && repo.pushedAt
    ? Math.max(0, (Date.parse(repo.pushedAt) - Date.parse(repo.createdAtGh)) / 86_400_000)
    : null
  if (lifespanDays !== null) {
    if (lifespanDays >= 30) { score += 3; notes.push('worked on over months') }
    else if (lifespanDays >= 7) { score += 2; notes.push('worked on over weeks') }
    else if (lifespanDays >= 1) { score += 1 }
  }

  // Recent work reflects current skill. Downstream scoring already decays
  // old evidence, so this only agrees with what happens later anyway.
  if (repo.pushedAt) {
    const ageDays = (now.getTime() - Date.parse(repo.pushedAt)) / 86_400_000
    if (ageDays <= 365) score += 2
    else if (ageDays <= 730) score += 1
    else notes.push('nothing pushed in over two years')
  }

  // Size, weighted lightly and only at the bottom end. GitHub's number
  // covers the whole repo including images and data, so a big number can
  // just mean someone committed a dataset — but a repo under ~10KB really
  // is a stub either way.
  if (repo.sizeKb !== null) {
    if (repo.sizeKb < 10) { score -= 3; notes.push('almost empty') }
    else if (repo.sizeKb >= 100) score += 1
  }

  // Someone who wrote a description treated it as a real project.
  if (repo.description && repo.description.trim().length > 0) score += 1

  // GitHub Pages is automatic, unlike the homepage field — which is set by
  // hand and mostly measures whether someone knew the field existed rather
  // than whether they shipped anything.
  if (repo.hasPages) { score += 2; notes.push('published a site') }

  // Almost every student has zero stars on genuinely good work, so this can
  // only ever add.
  if ((repo.stars ?? 0) >= 25) score += 2
  else if ((repo.stars ?? 0) >= 5) score += 1

  const reason = notes.length > 0 ? notes.join(', ') : 'ordinary project'
  return { score, reason }
}

/**
 * Decide which repos to switch on.
 *
 * The cut is not a straight top-N. Taking the highest 25 by score would
 * spend the budget on whatever the student has most of — eight React repos
 * that each add almost nothing after the second — while dropping the one
 * Rust project, which is the only evidence of that skill they have. So one
 * repo per distinct language is kept regardless of where it ranked.
 */
export function rankRepos(
  repos: RankableRepo[],
  options: { limit?: number; now?: Date } = {},
): RankedRepo[] {
  const limit = options.limit ?? DEFAULT_SCAN_LIMIT
  const now = options.now ?? new Date()

  const scored: RankedRepo[] = repos.map((r) => {
    const { score, reason } = scoreRepo(r, now)
    return { ...r, score, reason, enabled: false }
  })

  // Only repos that could actually be scanned compete for the slots. A
  // private repo nobody has opted in on would otherwise occupy a slot and
  // then not be scanned, quietly shrinking the real budget.
  const eligible = scored.filter((r) => r.scanChoice !== 'off' && (!r.isPrivate || r.scanChoice === 'on'))
  eligible.sort((a, b) => b.score - a.score)

  const chosen = new Set<string>()

  // The student's own choices and their briefs come first and don't consume
  // judgement, only slots.
  for (const r of eligible) {
    if (r.scanChoice === 'on' || r.linkedToBrief) chosen.add(r.repoFullName)
  }

  // One per language before filling by rank, so a lone Rust project isn't
  // crowded out by a pile of JavaScript.
  const languageSeen = new Set<string>()
  for (const r of eligible) {
    if (chosen.has(r.repoFullName)) {
      if (r.primaryLanguage) languageSeen.add(r.primaryLanguage)
      continue
    }
    const lang = r.primaryLanguage
    if (!lang || languageSeen.has(lang)) continue
    if (r.score <= -5) continue // forks and archived repos don't earn a slot on rarity
    languageSeen.add(lang)
    chosen.add(r.repoFullName)
    r.reason = `only ${lang} project — kept so that skill isn't lost`
  }

  for (const r of eligible) {
    if (chosen.size >= limit) break
    chosen.add(r.repoFullName)
  }

  // The floor. Applied after everything else so it only ever adds.
  if (chosen.size < MINIMUM_ENABLED) {
    for (const r of eligible) {
      if (chosen.size >= MINIMUM_ENABLED) break
      chosen.add(r.repoFullName)
    }
  }

  for (const r of scored) {
    r.enabled = chosen.has(r.repoFullName)
    if (!r.enabled && r.scanChoice !== 'off' && !r.isFork && !r.isArchived) {
      r.reason = `${r.reason} — not scanned by default, switch it on if it matters`
    }
    if (r.scanChoice === 'off') r.reason = 'you turned this off'
    if (r.scanChoice === 'on') r.reason = 'you turned this on'
  }

  return scored
}
