// "Proof it runs" (§3) — a BONUS signal that feeds the complexity
// composite, never a gate on whether a repo counts as evidence at all
// (that decision was reversed from the original spec; see schema.sql's
// artifacts.verification_method comment). Checked in order of strength;
// the first one that succeeds wins:
//
//   1. GitHub Deployments API — Vercel/Netlify/Render/Fly/Pages all write
//      deployment records back to the repo. GitHub-attested, effectively
//      unforgeable given the App's repo grant.
//   2. Package registry — npm/PyPI, with the registry's own `repository`
//      field checked against this repo, not just presence of a
//      same-named package (a same-named-but-unrelated package would
//      otherwise falsely "verify" an unrelated repo).
//   3. Passing CI on the default branch — weaker (proves it builds and
//      tests pass, not that anything is running in the world) but real.
//
// A fourth tier — human review for demos that aren't machine-checkable —
// isn't implemented here; that's a review-queue UI decision (task #15),
// not a check this module can perform.

import type { Octokit } from '@octokit/rest'
import { getInstallationOctokit } from './app'
import { getFileContent } from './scan'

export interface DeploymentVerification {
  verified: boolean
  method: 'deployment' | 'package' | 'ci' | null
  url: string | null
}

export async function verifyDeployment(
  installationId: string,
  repoFullName: string,
  defaultBranch: string,
): Promise<DeploymentVerification> {
  const [owner, repo] = repoFullName.split('/')
  const octokit = await getInstallationOctokit(installationId)

  const viaDeployment = await checkDeploymentsApi(octokit, owner, repo)
  if (viaDeployment) return viaDeployment

  const viaPackage = await checkPackageRegistries(octokit, owner, repo, repoFullName)
  if (viaPackage) return viaPackage

  const viaCi = await checkPassingCi(octokit, owner, repo, defaultBranch)
  if (viaCi) return viaCi

  return { verified: false, method: null, url: null }
}

async function checkDeploymentsApi(octokit: Octokit, owner: string, repo: string): Promise<DeploymentVerification | null> {
  try {
    const { data: deployments } = await octokit.rest.repos.listDeployments({ owner, repo, per_page: 10 })
    for (const deployment of deployments) {
      const { data: statuses } = await octokit.rest.repos.listDeploymentStatuses({
        owner, repo, deployment_id: deployment.id, per_page: 10,
      })
      const success = statuses.find((s) => s.state === 'success' && s.environment_url)
      if (success) {
        return { verified: true, method: 'deployment', url: success.environment_url ?? null }
      }
    }
  } catch {
    // No deployments, or the endpoint isn't accessible — not an error
    // worth surfacing, just means this tier didn't verify anything.
  }
  return null
}

async function checkPackageRegistries(
  octokit: Octokit, owner: string, repo: string, repoFullName: string,
): Promise<DeploymentVerification | null> {
  const packageJson = await getFileContent(octokit, owner, repo, 'package.json')
  if (packageJson) {
    try {
      const pkg = JSON.parse(packageJson)
      if (pkg.name) {
        const result = await checkNpm(pkg.name, repoFullName)
        if (result) return result
      }
    } catch {
      // malformed package.json — fall through to PyPI check
    }
  }

  const pyproject = await getFileContent(octokit, owner, repo, 'pyproject.toml')
  if (pyproject) {
    const nameMatch = pyproject.match(/\[project\][\s\S]*?\bname\s*=\s*["']([^"']+)["']/) ??
                       pyproject.match(/\[tool\.poetry\][\s\S]*?\bname\s*=\s*["']([^"']+)["']/)
    if (nameMatch) {
      const result = await checkPyPI(nameMatch[1], repoFullName)
      if (result) return result
    }
  }

  return null
}

function repoMatchesRepository(repositoryField: unknown, repoFullName: string): boolean {
  const str = typeof repositoryField === 'string'
    ? repositoryField
    : (repositoryField as { url?: string } | undefined)?.url
  if (!str) return false
  return str.toLowerCase().includes(repoFullName.toLowerCase())
}

async function checkNpm(packageName: string, repoFullName: string): Promise<DeploymentVerification | null> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}`)
    if (!res.ok) return null
    const data = await res.json()
    const repository = data.repository ?? data.versions?.[data['dist-tags']?.latest]?.repository
    if (repoMatchesRepository(repository, repoFullName)) {
      return { verified: true, method: 'package', url: `https://www.npmjs.com/package/${packageName}` }
    }
  } catch {
    // registry unreachable or package doesn't exist — not verified via npm
  }
  return null
}

async function checkPyPI(packageName: string, repoFullName: string): Promise<DeploymentVerification | null> {
  try {
    const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`)
    if (!res.ok) return null
    const data = await res.json()
    const projectUrls = data.info?.project_urls ?? {}
    const candidates = [data.info?.home_page, ...Object.values(projectUrls)].filter(Boolean) as string[]
    if (candidates.some((url) => url.toLowerCase().includes(repoFullName.toLowerCase()))) {
      return { verified: true, method: 'package', url: `https://pypi.org/project/${packageName}/` }
    }
  } catch {
    // registry unreachable or package doesn't exist — not verified via PyPI
  }
  return null
}

async function checkPassingCi(
  octokit: Octokit, owner: string, repo: string, defaultBranch: string,
): Promise<DeploymentVerification | null> {
  try {
    const { data } = await octokit.rest.actions.listWorkflowRunsForRepo({
      owner, repo, branch: defaultBranch, status: 'success', per_page: 1,
    })
    if (data.total_count > 0 && data.workflow_runs[0]) {
      return { verified: true, method: 'ci', url: data.workflow_runs[0].html_url }
    }
  } catch {
    // no Actions configured, or the endpoint failed — not verified via CI
  }
  return null
}
