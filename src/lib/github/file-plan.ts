// Given a repo's file list, decide what is worth reading.
//
// The scan used to guess at five fixed paths and fetch each blind, which
// meant a manifest one directory down was invisible and every miss cost a
// wasted 404. One recursive tree call returns the whole file list, and this
// module turns that list into a bounded, prioritised fetch plan.
//
// Bounded matters. A monorepo can contain hundreds of package.json files,
// and fetching all of them would turn one repo into a rate-limit incident.
// Every category has a cap, and the caps are small on purpose: the goal is
// to characterise a repo, not to inventory it.

import { manifestKindForPath, type ManifestKind } from './manifests'

export interface TreeEntry {
  path: string
  type: string
  size?: number
}

export type PlannedKind =
  | { kind: 'manifest'; manifest: ManifestKind }
  | { kind: 'compose' }
  | { kind: 'dockerfile' }
  | { kind: 'prisma' }
  | { kind: 'orm-config' }
  | { kind: 'sql' }
  | { kind: 'terraform' }
  | { kind: 'workflow' }

export interface PlannedFile {
  path: string
  plan: PlannedKind
}

export interface FilePlan {
  files: PlannedFile[]
  /** Detections available from path names alone — no fetch needed. */
  presence: { raw: string; where: string }[]
}

const CAPS: Record<PlannedKind['kind'], number> = {
  manifest: 12,
  compose: 2,
  dockerfile: 3,
  prisma: 2,
  'orm-config': 2,
  sql: 5,
  terraform: 3,
  workflow: 3,
}

/** Skip anything under these — it isn't the student's work. */
const VENDOR_DIR = /(^|\/)(node_modules|vendor|third_party|\.venv|venv|dist|build|target|\.next|coverage)(\/|$)/

/** A file too big to be worth reading for a few regex matches. */
const MAX_FILE_BYTES = 400_000

const ORM_CONFIG = /(^|\/)(drizzle\.config\.(ts|js|mjs)|knexfile\.(ts|js)|sequelize(rc)?\.(json|js)|ormconfig\.(json|ts|js)|alembic\.ini)$/i
const K8S_DIR = /(^|\/)(k8s|kubernetes|helm|charts)(\/|$)/i

export function planFiles(tree: TreeEntry[]): FilePlan {
  const files: PlannedFile[] = []
  const presence: { raw: string; where: string }[] = []
  const counts: Record<string, number> = {}
  const seenPresence = new Set<string>()

  function take(kind: PlannedKind['kind']): boolean {
    const n = counts[kind] ?? 0
    if (n >= CAPS[kind]) return false
    counts[kind] = n + 1
    return true
  }

  function addPresence(raw: string, where: string) {
    if (seenPresence.has(raw)) return
    seenPresence.add(raw)
    presence.push({ raw, where })
  }

  // Shallower paths first, so when a cap bites it keeps the root manifest
  // rather than whichever nested one the API happened to list first.
  const candidates = tree
    .filter((e) => e.type === 'blob' && !VENDOR_DIR.test(e.path))
    .filter((e) => (e.size ?? 0) <= MAX_FILE_BYTES)
    .sort((a, b) => a.path.split('/').length - b.path.split('/').length)

  for (const entry of candidates) {
    const path = entry.path
    const base = path.split('/').pop() ?? ''

    const manifest = manifestKindForPath(path)
    if (manifest) {
      if (take('manifest')) files.push({ path, plan: { kind: 'manifest', manifest } })
      continue
    }

    if (/^docker-compose(\.[\w-]+)?\.ya?ml$/i.test(base) || /^compose\.ya?ml$/i.test(base)) {
      if (take('compose')) files.push({ path, plan: { kind: 'compose' } })
      continue
    }

    if (base === 'Dockerfile' || /^Dockerfile\./i.test(base) || /\.dockerfile$/i.test(base)) {
      if (take('dockerfile')) files.push({ path, plan: { kind: 'dockerfile' } })
      continue
    }

    if (base === 'schema.prisma') {
      if (take('prisma')) files.push({ path, plan: { kind: 'prisma' } })
      continue
    }

    if (ORM_CONFIG.test(path)) {
      if (take('orm-config')) files.push({ path, plan: { kind: 'orm-config' } })
      continue
    }

    if (path.endsWith('.sql')) {
      if (take('sql')) files.push({ path, plan: { kind: 'sql' } })
      else addPresence('SQL', path)
      continue
    }

    if (path.endsWith('.tf')) {
      if (take('terraform')) files.push({ path, plan: { kind: 'terraform' } })
      else addPresence('Terraform', path)
      continue
    }

    if (/^\.github\/workflows\/.+\.ya?ml$/i.test(path)) {
      if (take('workflow')) files.push({ path, plan: { kind: 'workflow' } })
      else addPresence('CI/CD', path)
      continue
    }

    // Path-only signals — nothing in the file would tell us more than its
    // location already does.
    if (K8S_DIR.test(path) && /\.ya?ml$/i.test(path)) addPresence('Kubernetes', path)
    if (base === 'Makefile') addPresence('Make', path)
    if (base === 'Vagrantfile') addPresence('Vagrant', path)
    if (/^\.gitlab-ci\.ya?ml$/i.test(base)) addPresence('CI/CD', path)
    if (/(^|\/)(Jenkinsfile)$/.test(path)) addPresence('CI/CD', path)
    if (/^ansible\//i.test(path) || base === 'playbook.yml') addPresence('Ansible', path)
    if (base === 'serverless.yml') addPresence('Serverless', path)
    if (/\.ipynb$/.test(path)) addPresence('Jupyter', path)
    if (/\.proto$/.test(path)) addPresence('Protocol Buffers', path)
    if (/\.graphql$/.test(path) || base === 'schema.gql') addPresence('GraphQL', path)
  }

  return { files, presence }
}
