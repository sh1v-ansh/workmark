// Per-repo GitHub API orchestration — fetches the RAW facts a repo can
// offer (languages, manifests, who authored what, fork status, CI/test/
// infra presence). Deliberately does no scoring or judgment here — that's
// complexity.ts, which takes this module's output as input. Keeping the
// boundary there means the "what do we know" step stays independently
// testable from the "how much does that count" step.

import type { Octokit } from '@octokit/rest'
import { getInstallationOctokit } from './app'
import { parseManifest } from './manifests'
import { planFiles, type TreeEntry } from './file-plan'
import { isStudentAuthored, TEST_PATH } from './code-signals'
import {
  detection, extractImports, parseComposeServices, parseDockerfile, parseOrmConfig,
  parsePrismaSchema, parseSqlFile, parseTerraform, parseWorkflow, type Detection,
} from './detectors'

export interface RepoScanResult {
  repoFullName: string
  skip: boolean
  skipReason?: string
  defaultBranch: string
  isFork: boolean
  languages: Record<string, number>       // language name -> byte count, whole repo
  /**
   * Every raw skill signal found, each carrying where it came from. Replaces
   * the old bare `manifestSkills: string[]` — the provenance is not
   * decoration, it's what lets the student be told why their record says
   * what it says, and what a dispute has to argue with.
   */
  detections: Detection[]
  /**
   * Contents of the student's own sampled source files, fetched once here
   * and reused by complexity extraction rather than fetched twice.
   */
  sampledSources: { path: string; content: string }[]
  /**
   * How many separate days the student committed on. A better measure of
   * sustained work than either commit count (inflated by tiny commits) or
   * elapsed time (inflated by a README fix two years later).
   */
  activeDays: number
  /** Days between their first and last commit here. */
  spanDays: number
  /**
   * Share of the student's sampled commits that changed a file one of their
   * earlier commits had already changed — did they come back and rework
   * things, or write once and never return. Null when there's too little
   * history to say anything.
   */
  revisitRate: number | null
  studentCommitCount: number
  totalCommitCount: number | null         // null if contributor stats never became available (see getContributorStats)
  fractionAuthored: number | null         // 0-1, null under the same condition
  distinctContributors: number | null     // null under the same condition — used to tell Tier 0 (solo) from Tier 0.5 (multi-contributor)
  firstCommitAt: string | null
  lastCommitAt: string | null
  filesTouchedByStudent: string[]
  hasTests: boolean
  hasCi: boolean
  hasDockerfile: boolean
  hasInfraConfig: boolean
}

const INFRA_PATH_PATTERN = /^(docker-compose\.ya?ml|\.terraform|main\.tf|k8s\/|kubernetes\/|helm\/)/i

/**
 * Fetches everything scan.ts needs for one repo. Never throws for a single
 * repo's own failures — sets skip/skipReason instead, so one bad repo in a
 * student's grant list doesn't abort scanning the rest of them.
 */
export async function scanRepo(
  installationId: string,
  githubLogin: string,
  repoFullName: string,
): Promise<RepoScanResult> {
  const [owner, repo] = repoFullName.split('/')
  const octokit = await getInstallationOctokit(installationId)

  const empty: RepoScanResult = {
    repoFullName, skip: true, defaultBranch: '', isFork: false,
    languages: {}, detections: [], sampledSources: [],
    activeDays: 0, spanDays: 0, revisitRate: null,
    studentCommitCount: 0, totalCommitCount: null,
    fractionAuthored: null, distinctContributors: null, firstCommitAt: null, lastCommitAt: null,
    filesTouchedByStudent: [], hasTests: false, hasCi: false, hasDockerfile: false, hasInfraConfig: false,
  }

  let repoMeta
  try {
    const { data } = await octokit.rest.repos.get({ owner, repo })
    repoMeta = data
  } catch (err) {
    return { ...empty, skipReason: `repo metadata fetch failed: ${(err as Error).message}` }
  }

  // Fork handling: a plain, undiverged fork is noise, not evidence — skip
  // it outright rather than scanning code the student didn't write. A fork
  // with real divergence is scanned normally; commit attribution below
  // already ensures only the student's own commits count regardless.
  if (repoMeta.fork && repoMeta.parent) {
    try {
      const { data: comparison } = await octokit.rest.repos.compareCommits({
        owner: repoMeta.parent.owner.login,
        repo: repoMeta.parent.name,
        base: repoMeta.parent.default_branch,
        head: `${owner}:${repoMeta.default_branch}`,
      })
      if (comparison.ahead_by === 0) {
        return { ...empty, skip: true, skipReason: 'fork with no divergence from parent', defaultBranch: repoMeta.default_branch, isFork: true }
      }
    } catch {
      // Comparison failing (e.g. parent repo deleted/private) isn't a
      // reason to skip — fall through and scan normally.
    }
  }

  // Round one: everything that doesn't depend on anything else. The tree is
  // the important addition — one call returns the repo's whole file list, so
  // what gets read next is chosen from what's actually there instead of
  // guessing at fixed paths and eating a 404 for each miss.
  const [languages, contributorStats, studentCommits, tree] = await Promise.all([
    fetchLanguages(octokit, owner, repo),
    getContributorStats(octokit, owner, repo, githubLogin),
    fetchStudentCommits(octokit, owner, repo, githubLogin),
    fetchTree(octokit, owner, repo, repoMeta.default_branch),
  ])

  const plan = planFiles(tree)

  // Round two: read the files the plan picked, plus a sample of the source
  // the student themselves touched. Both are capped and run at bounded
  // concurrency — a repo shouldn't be able to open dozens of sockets and
  // trip GitHub's secondary rate limit.
  const [planned, sampledSources] = await Promise.all([
    fetchPlanned(octokit, owner, repo, plan.files),
    fetchStudentSources(octokit, owner, repo, studentCommits.filesTouched),
  ])

  const detections: Detection[] = [
    ...Object.keys(languages).map((l) => detection(l, 'language', 'GitHub language stats')),
    ...plan.presence.map((p) => detection(p.raw, 'file', p.where)),
    ...planned,
    ...sampledSources.flatMap((f) => extractImports(f.content, f.path)),
  ]

  const hasDockerfile = detections.some((d) => d.source === 'dockerfile')
  const hasCi = detections.some((d) => d.source === 'workflow')

  // hasTests / hasInfraConfig are derived from the files the student's own
  // sampled commits touched (fetchStudentCommits), not a separate API
  // call — a repo having a tests/ directory somewhere doesn't mean THIS
  // student wrote any of it, whereas hasCi/hasDockerfile are repo-level
  // facts (checkFilePresence) since a config file's existence isn't
  // authorship-scoped the way source files are.
  const hasTests = studentCommits.filesTouched.some((f) => TEST_PATH.test(f))
  const hasInfraConfig = studentCommits.filesTouched.some((f) => INFRA_PATH_PATTERN.test(f))

  return {
    repoFullName,
    skip: false,
    defaultBranch: repoMeta.default_branch,
    isFork: !!repoMeta.fork,
    languages,
    detections,
    sampledSources,
    studentCommitCount: studentCommits.commits.length,
    totalCommitCount: contributorStats?.totalCommits ?? null,
    fractionAuthored: contributorStats
      ? (contributorStats.studentCommits / Math.max(contributorStats.totalCommits, 1))
      : null,
    distinctContributors: contributorStats?.distinctContributors ?? null,
    firstCommitAt: studentCommits.firstAt,
    lastCommitAt: studentCommits.lastAt,
    filesTouchedByStudent: studentCommits.filesTouched,
    hasTests,
    hasCi,
    hasDockerfile,
    hasInfraConfig,
    activeDays: studentCommits.activeDays,
    spanDays: studentCommits.spanDays,
    revisitRate: studentCommits.revisitRate,
  }
}

async function fetchLanguages(octokit: Octokit, owner: string, repo: string): Promise<Record<string, number>> {
  try {
    const { data } = await octokit.rest.repos.listLanguages({ owner, repo })
    return data
  } catch {
    return {}
  }
}

/**
 * GET /repos/{owner}/{repo}/stats/contributors is famously eventually
 * consistent — GitHub computes it asynchronously and returns 202 with an
 * empty body on first request while it's still working.
 *
 * Two attempts with a short backoff, not three with 1.5s gaps: the old
 * shape spent up to 3 seconds sleeping PER REPO on a signal that is only
 * used to pick Tier 0 vs Tier 0.5 and to fill fractionAuthored. Paying
 * seconds of wall-clock for a nice-to-have is the wrong trade when the
 * caller already handles null — and because the endpoint caches once
 * GitHub finishes computing, the next scan of the same repo gets it free.
 */
async function getContributorStats(
  octokit: Octokit, owner: string, repo: string, githubLogin: string,
): Promise<{ studentCommits: number; totalCommits: number; distinctContributors: number } | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { status, data } = await octokit.rest.repos.getContributorsStats({ owner, repo })
    if (status === 200 && Array.isArray(data)) {
      let studentCommits = 0
      let totalCommits = 0
      let distinctContributors = 0
      for (const c of data) {
        const commits = c.total ?? 0
        if (commits === 0) continue
        totalCommits += commits
        distinctContributors++
        if (c.author?.login?.toLowerCase() === githubLogin.toLowerCase()) studentCommits = commits
      }
      return { studentCommits, totalCommits, distinctContributors }
    }
    if (attempt < 1) await new Promise((r) => setTimeout(r, 600))
  }
  return null
}

interface StudentCommits {
  commits: string[]
  firstAt: string | null
  lastAt: string | null
  filesTouched: string[]
  activeDays: number
  spanDays: number
  revisitRate: number | null
}

async function fetchStudentCommits(
  octokit: Octokit, owner: string, repo: string, githubLogin: string,
): Promise<StudentCommits> {
  const commits: string[] = []
  const filesTouched = new Set<string>()
  const commitDays = new Set<string>()
  /** One entry per sampled commit, newest first — the input to revisit rate. */
  const perCommitFiles: string[][] = []
  let firstAt: string | null = null
  let lastAt: string | null = null
  let revisitRate: number | null = null

  try {
    // Capped at 3 pages (300 commits) — plenty for a student project; this
    // is meant to characterize authorship, not build a complete history.
    for (let page = 1; page <= 3; page++) {
      const { data } = await octokit.rest.repos.listCommits({ owner, repo, author: githubLogin, per_page: 100, page })
      if (data.length === 0) break
      for (const c of data) {
        commits.push(c.sha)
        const date = c.commit.author?.date ?? null
        if (date && (!firstAt || date < firstAt)) firstAt = date
        if (date && (!lastAt || date > lastAt)) lastAt = date
        // Distinct calendar days, not commit count: ten commits in one
        // evening is one day's work however it's split up.
        if (date) commitDays.add(date.slice(0, 10))
      }
      if (data.length < 100) break
    }

    // File-level detail requires a per-commit fetch, which is expensive at
    // scale — sample the most recent 20 rather than every commit, enough
    // to characterize which parts of the repo the student actually touches
    // without a request-per-commit blowup on large histories.
    //
    // Fetched in parallel: these were previously awaited one at a time,
    // which made a single repo cost 20 serial round trips (~5s) for what is
    // 20 independent reads. Capped concurrency rather than a bare
    // Promise.all so a student with many repos doesn't open 20 sockets per
    // repo and trip GitHub's abuse-detection secondary rate limit.
    const sample = commits.slice(0, 20)
    const CONCURRENCY = 5
    for (let i = 0; i < sample.length; i += CONCURRENCY) {
      const details = await Promise.all(
        sample.slice(i, i + CONCURRENCY).map(async (sha) => {
          try {
            const { data } = await octokit.rest.repos.getCommit({ owner, repo, ref: sha })
            return data.files ?? []
          } catch {
            // A single commit detail failing isn't worth aborting the sample over.
            return []
          }
        }),
      )
      for (const files of details) {
        // Vendored and generated paths are dropped here, not later: one
        // commit that checked in node_modules used to add a thousand files
        // to "files this student touched" and inflate everything derived
        // from it. listCommits returns newest first, so these accumulate in
        // that order and get reversed for the revisit pass below.
        const authored = files.map((f) => f.filename).filter(isStudentAuthored)
        perCommitFiles.push(authored)
        for (const f of authored) filesTouched.add(f)
      }
    }

    // Did they come back to their own work? Walk oldest-first and count how
    // many commits touched a file an earlier commit of theirs had already
    // changed. Write-once-and-abandon sits near 0; sustained work on one
    // codebase sits high. Costs nothing — these file lists were already
    // fetched for filesTouched.
    const chronological = perCommitFiles.slice().reverse().filter((f) => f.length > 0)
    // Fewer than four commits can't say anything either way — one person's
    // three-commit project isn't evidence of abandoning it.
    if (chronological.length >= 4) {
      const seen = new Set<string>()
      let revisits = 0
      for (let i = 0; i < chronological.length; i++) {
        // The first commit has nothing to revisit, so it's excluded from
        // both the numerator and the denominator.
        if (i > 0 && chronological[i].some((f) => seen.has(f))) revisits++
        for (const f of chronological[i]) seen.add(f)
      }
      revisitRate = revisits / (chronological.length - 1)
    }
  } catch {
    // No commits attributable to this login (or the API call failed) —
    // return whatever was gathered before the failure.
  }

  const spanDays = firstAt && lastAt
    ? Math.max(0, Math.round((Date.parse(lastAt) - Date.parse(firstAt)) / 86_400_000))
    : 0

  return {
    commits,
    firstAt,
    lastAt,
    filesTouched: Array.from(filesTouched),
    activeDays: commitDays.size,
    spanDays,
    revisitRate,
  }
}

/**
 * The repo's complete file list in one request.
 *
 * `truncated` comes back on very large repos, in which case this is a
 * partial list — acceptable, because the plan is prioritised shallowest-
 * first and a repo big enough to truncate has its root files listed well
 * before the cutoff.
 */
async function fetchTree(
  octokit: Octokit, owner: string, repo: string, branch: string,
): Promise<TreeEntry[]> {
  try {
    const { data } = await octokit.rest.git.getTree({
      owner, repo, tree_sha: branch, recursive: '1',
    })
    return (data.tree ?? []).map((e) => ({
      path: e.path ?? '', type: e.type ?? '', size: e.size,
    })).filter((e) => e.path)
  } catch {
    // A repo with no commits, or a branch name that doesn't resolve. The
    // scan continues on languages and commits alone.
    return []
  }
}

/** How many planned config files to read at once. */
const FETCH_CONCURRENCY = 6

async function fetchPlanned(
  octokit: Octokit, owner: string, repo: string, files: { path: string; plan: { kind: string; manifest?: string } }[],
): Promise<Detection[]> {
  const out: Detection[] = []

  for (let i = 0; i < files.length; i += FETCH_CONCURRENCY) {
    const batch = files.slice(i, i + FETCH_CONCURRENCY)
    const contents = await Promise.all(
      batch.map(async (f) => ({ file: f, content: await getFileContent(octokit, owner, repo, f.path) })),
    )
    for (const { file, content } of contents) {
      if (!content) continue
      const { path } = file
      switch (file.plan.kind) {
        case 'manifest':
          for (const dep of parseManifest(file.plan.manifest as never, content)) {
            out.push(detection(dep, 'manifest', path))
          }
          break
        case 'compose': out.push(...parseComposeServices(content, path)); break
        case 'dockerfile': out.push(...parseDockerfile(content, path)); break
        case 'prisma': out.push(...parsePrismaSchema(content, path)); break
        case 'orm-config': out.push(...parseOrmConfig(content, path)); break
        case 'sql': out.push(...parseSqlFile(content, path)); break
        case 'terraform': out.push(...parseTerraform(content, path)); break
        case 'workflow': out.push(...parseWorkflow(content, path)); break
      }
    }
  }

  return out
}

/** Which of the student's touched files are source worth reading. */
const SOURCE_FILE_PATTERN = /\.(js|jsx|ts|tsx|py|go|rs|java|kt|rb|php|c|cpp|cc|h|hpp|cs|swift|scala|m|mm)$/i

/**
 * Cap on source files read per repo. These feed two things at once — import
 * extraction here and the complexity regexes downstream — so the number is a
 * shared budget rather than one each.
 */
const SOURCE_FILE_SAMPLE_LIMIT = 15

async function fetchStudentSources(
  octokit: Octokit, owner: string, repo: string, filesTouched: string[],
): Promise<{ path: string; content: string }[]> {
  const sample = filesTouched.filter((p) => SOURCE_FILE_PATTERN.test(p)).slice(0, SOURCE_FILE_SAMPLE_LIMIT)
  const out: { path: string; content: string }[] = []

  for (let i = 0; i < sample.length; i += FETCH_CONCURRENCY) {
    const contents = await Promise.all(
      sample.slice(i, i + FETCH_CONCURRENCY).map(async (path) => ({
        path, content: await getFileContent(octokit, owner, repo, path),
      })),
    )
    for (const c of contents) if (c.content) out.push({ path: c.path, content: c.content })
  }

  return out
}

export async function getFileContent(octokit: Octokit, owner: string, repo: string, path: string): Promise<string | null> {
  try {
    const { data } = await octokit.rest.repos.getContent({ owner, repo, path })
    if ('content' in data && typeof data.content === 'string') {
      return Buffer.from(data.content, 'base64').toString('utf-8')
    }
    return null
  } catch {
    return null // 404 is the overwhelmingly common case — most repos don't have every manifest
  }
}

// checkFilePresence used to probe for `.github/workflows` and a root
// `Dockerfile` with two speculative requests. Both facts now fall out of
// the tree listing for free, and unlike the old check they find a Dockerfile
// that isn't at the repo root.
