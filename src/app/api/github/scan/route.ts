import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { DEP_FILE_NAMES, skillsFromDepFile, analyzeRepoStructure } from '@/lib/data/skills'

/**
 * POST /api/github/scan
 *
 * Reads the caller's linked GitHub identity (stored by Supabase Auth when they
 * linked GitHub via linkIdentity()), enumerates their repos where they are a
 * contributor, downloads ONLY the dependency-file manifests, maps entries to
 * the normalized skill taxonomy, and upserts github_evidenced_skills.
 *
 * Per spec §5.1.2, we never read or store source code — only manifest files.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  // The GitHub access token lives in github_connections (populated by our
  // own OAuth callback route). We need service_role to read the token
  // because RLS only lets the student SELECT it via their own session,
  // and we want to be consistent with how the rest of the endpoint runs.
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: connection, error: connErr } = await admin
    .from('github_connections')
    .select('access_token, github_login')
    .eq('student_id', user.id)
    .maybeSingle()

  if (connErr) return NextResponse.json({ error: 'Could not read connection.' }, { status: 500 })
  if (!connection?.access_token) return NextResponse.json({ error: 'GitHub not connected. Click Connect GitHub first.' }, { status: 400 })

  const ghToken = connection.access_token as string
  const ghUsername = connection.github_login as string | null

  // Mirror the login onto students.github_username so the dashboard reflects
  // the connected state even if the row was written by a different session.
  if (ghUsername) {
    await supabase.from('students').update({ github_username: ghUsername }).eq('id', user.id)
  }

  const headers = {
    Authorization: `Bearer ${ghToken}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'workmark-scanner',
    'X-GitHub-Api-Version': '2022-11-28',
  }

  // List repos where the user is a contributor. GitHub's default /user/repos
  // returns repos they have push access to — sufficient for MVP. Cap at 30 to
  // keep the scan fast for the pitch demo.
  const reposRes = await fetch('https://api.github.com/user/repos?per_page=30&sort=updated&affiliation=owner,collaborator', { headers })
  if (!reposRes.ok) {
    const body = await reposRes.text()
    return NextResponse.json({ error: `GitHub API: ${reposRes.status} ${body.slice(0, 200)}` }, { status: 502 })
  }
  const repos = (await reposRes.json()) as Array<{ full_name: string; default_branch: string; html_url: string; fork: boolean }>

  // For each repo, collect:
  //   1. Manifest contents → normalized skills (Tier 3 evidence)
  //   2. Root file/dir listing → structural profile (project type, arch, maturity)
  const skillEvidence = new Map<string, { count: number; repos: Set<string> }>()
  const repoProfiles: Array<{
    repo_full_name: string; repo_url: string; project_type: string; architecture: string;
    has_tests: boolean; has_ci: boolean; has_docker: boolean; has_docs: boolean; has_auth: boolean; has_deploy_config: boolean;
  }> = []
  let scanned = 0

  for (const repo of repos) {
    if (repo.fork) continue // forks are noisy — spec §5.1.2 spirit is real work only
    scanned++

    // Fetch the repo root tree (shallow — top-level entries only).
    const rootRes = await fetch(`https://api.github.com/repos/${repo.full_name}/contents?ref=${repo.default_branch}`, { headers })
    const rootEntries = rootRes.ok
      ? (await rootRes.json() as Array<{ name: string; type: 'file' | 'dir' | 'symlink' | 'submodule' }>)
          .filter((e) => e.type === 'file' || e.type === 'dir')
          .map((e) => ({ name: e.name, type: e.type as 'file' | 'dir' }))
      : []

    // Fetch each manifest file that appears at the root (avoids 404 for missing ones).
    const rootFileNames = new Set(rootEntries.filter((e) => e.type === 'file').map((e) => e.name.toLowerCase()))
    const manifests: Partial<Record<string, string>> = {}
    for (const depFile of DEP_FILE_NAMES) {
      if (!rootFileNames.has(depFile.toLowerCase())) continue
      const url = `https://api.github.com/repos/${repo.full_name}/contents/${depFile}?ref=${repo.default_branch}`
      const res = await fetch(url, { headers })
      if (!res.ok) continue
      const payload = (await res.json()) as { content?: string; encoding?: string }
      if (!payload.content || payload.encoding !== 'base64') continue
      const contents = Buffer.from(payload.content, 'base64').toString('utf-8')
      manifests[depFile.toLowerCase()] = contents

      const skills = skillsFromDepFile(depFile, contents)
      for (const skill of skills) {
        const cur = skillEvidence.get(skill) ?? { count: 0, repos: new Set<string>() }
        if (!cur.repos.has(repo.html_url)) {
          cur.count++
          cur.repos.add(repo.html_url)
        }
        skillEvidence.set(skill, cur)
      }
    }

    // Count workflow files under .github/workflows for CI detection.
    let workflowsCount = 0
    if (rootEntries.some((e) => e.type === 'dir' && e.name === '.github')) {
      const wfRes = await fetch(`https://api.github.com/repos/${repo.full_name}/contents/.github/workflows?ref=${repo.default_branch}`, { headers })
      if (wfRes.ok) {
        const wfEntries = (await wfRes.json() as Array<{ name: string }>).filter(Boolean)
        workflowsCount = wfEntries.length
      }
    }

    const profile = analyzeRepoStructure({ rootEntries, manifests: manifests as never, workflowsCount })
    repoProfiles.push({
      repo_full_name: repo.full_name,
      repo_url: repo.html_url,
      project_type: profile.projectType,
      architecture: profile.architecture,
      has_tests: profile.hasTests,
      has_ci: profile.hasCi,
      has_docker: profile.hasDocker,
      has_docs: profile.hasDocs,
      has_auth: profile.hasAuth,
      has_deploy_config: profile.hasDeployConfig,
    })
  }

  // Wipe + reinsert both tables for a clean state per scan.
  await Promise.all([
    supabase.from('github_evidenced_skills').delete().eq('student_id', user.id),
    supabase.from('github_repo_profiles').delete().eq('student_id', user.id),
  ])

  const skillRows = Array.from(skillEvidence.entries()).map(([skill, { count, repos }]) => ({
    student_id: user.id,
    skill,
    evidence_count: count,
    repo_urls: Array.from(repos),
  }))
  if (skillRows.length > 0) {
    const { error: insertErr } = await supabase.from('github_evidenced_skills').insert(skillRows)
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  const profileRows = repoProfiles.map((p) => ({ ...p, student_id: user.id }))
  if (profileRows.length > 0) {
    const { error: profileErr } = await supabase.from('github_repo_profiles').insert(profileRows)
    if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 })
  }

  return NextResponse.json({ repos: scanned, skills: skillRows.length, profiles: profileRows.length })
}
