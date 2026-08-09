// Per-repo GitHub API orchestration — fetches the RAW facts a repo can
// offer (languages, manifests, who authored what, fork status, CI/test/
// infra presence). Deliberately does no scoring or judgment here — that's
// complexity.ts, which takes this module's output as input. Keeping the
// boundary there means the "what do we know" step stays independently
// testable from the "how much does that count" step.

import type { Octokit } from '@octokit/rest'
import { getInstallationOctokit } from './app'
import { MANIFEST_PATHS, parseManifest, type ManifestKind } from './manifests'

export interface RepoScanResult {
  repoFullName: string
  skip: boolean
  skipReason?: string
  defaultBranch: string
  isFork: boolean
  languages: Record<string, number>       // language name -> byte count, whole repo
  manifestSkills: string[]                // raw dependency names, whole repo, deduped
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

const TEST_PATH_PATTERN = /(^|\/)(tests?|__tests__|spec)(\/|$)|\.(test|spec)\.[a-z]+$/i
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
    languages: {}, manifestSkills: [], studentCommitCount: 0, totalCommitCount: null,
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

  const [languages, contributorStats, studentCommits, manifestSkills, presence] = await Promise.all([
    fetchLanguages(octokit, owner, repo),
    getContributorStats(octokit, owner, repo, githubLogin),
    fetchStudentCommits(octokit, owner, repo, githubLogin),
    fetchManifestSkills(octokit, owner, repo),
    checkFilePresence(octokit, owner, repo),
  ])

  // hasTests / hasInfraConfig are derived from the files the student's own
  // sampled commits touched (fetchStudentCommits), not a separate API
  // call — a repo having a tests/ directory somewhere doesn't mean THIS
  // student wrote any of it, whereas hasCi/hasDockerfile are repo-level
  // facts (checkFilePresence) since a config file's existence isn't
  // authorship-scoped the way source files are.
  const hasTests = studentCommits.filesTouched.some((f) => TEST_PATH_PATTERN.test(f))
  const hasInfraConfig = studentCommits.filesTouched.some((f) => INFRA_PATH_PATTERN.test(f))

  return {
    repoFullName,
    skip: false,
    defaultBranch: repoMeta.default_branch,
    isFork: !!repoMeta.fork,
    languages,
    manifestSkills,
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
    hasCi: presence.hasCi,
    hasDockerfile: presence.hasDockerfile,
    hasInfraConfig,
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
 * empty body on first request while it's still working. Poll a few times
 * with a short backoff; if it never materializes, return null and let the
 * caller treat fractionAuthored as unknown rather than blocking the scan
 * indefinitely on one slow endpoint.
 */
async function getContributorStats(
  octokit: Octokit, owner: string, repo: string, githubLogin: string,
): Promise<{ studentCommits: number; totalCommits: number; distinctContributors: number } | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
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
    if (attempt < 2) await new Promise((r) => setTimeout(r, 1500))
  }
  return null
}

async function fetchStudentCommits(
  octokit: Octokit, owner: string, repo: string, githubLogin: string,
): Promise<{ commits: string[]; firstAt: string | null; lastAt: string | null; filesTouched: string[] }> {
  const commits: string[] = []
  const filesTouched = new Set<string>()
  let firstAt: string | null = null
  let lastAt: string | null = null

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
      }
      if (data.length < 100) break
    }

    // File-level detail requires a per-commit fetch, which is expensive at
    // scale — sample the most recent 20 rather than every commit, enough
    // to characterize which parts of the repo the student actually touches
    // without a request-per-commit blowup on large histories.
    for (const sha of commits.slice(0, 20)) {
      try {
        const { data: detail } = await octokit.rest.repos.getCommit({ owner, repo, ref: sha })
        for (const f of detail.files ?? []) filesTouched.add(f.filename)
      } catch {
        // A single commit detail failing isn't worth aborting the sample over.
      }
    }
  } catch {
    // No commits attributable to this login (or the API call failed) —
    // return whatever was gathered before the failure.
  }

  return { commits, firstAt, lastAt, filesTouched: Array.from(filesTouched) }
}

async function fetchManifestSkills(octokit: Octokit, owner: string, repo: string): Promise<string[]> {
  const skills = new Set<string>()
  await Promise.all(
    MANIFEST_PATHS.map(async (path) => {
      const content = await getFileContent(octokit, owner, repo, path)
      if (content) {
        for (const dep of parseManifest(path as ManifestKind, content)) skills.add(dep)
      }
    }),
  )
  return Array.from(skills)
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

async function checkFilePresence(
  octokit: Octokit, owner: string, repo: string,
): Promise<{ hasCi: boolean; hasDockerfile: boolean }> {
  let hasCi = false
  try {
    await octokit.rest.repos.getContent({ owner, repo, path: '.github/workflows' })
    hasCi = true
  } catch {
    // no workflows directory
  }

  let hasDockerfile = false
  try {
    await octokit.rest.repos.getContent({ owner, repo, path: 'Dockerfile' })
    hasDockerfile = true
  } catch {
    // no Dockerfile at repo root — a Dockerfile nested in a subdirectory
    // won't be caught by this single check; acceptable false negative for
    // a presence signal rather than an exhaustive search.
  }

  return { hasCi, hasDockerfile }
}
