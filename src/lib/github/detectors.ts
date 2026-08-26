// Skill signals that don't live in a dependency file.
//
// The scan used to read manifests and GitHub's language stats and nothing
// else, which meant a whole category of real work was invisible: the
// database you ran in docker-compose, the Terraform you wrote, the schema
// in your .sql files, the library you imported without adding to a manifest.
// Most visibly, a project using Postgres through Supabase or Prisma
// recorded "Supabase" and "Prisma" and never Postgres itself.
//
// Every function here returns Detections rather than bare strings. The
// `where` field is the point: when a student asks why their record says
// PostgreSQL, the answer has to be "docker-compose.yml line 12", not a
// shrug. That answer is also what a dispute needs.

/** Where a detection came from — coarse enough to explain, fine enough to debug. */
export type DetectionSource =
  | 'language'      // GitHub's language stats
  | 'manifest'      // a dependency file
  | 'compose'       // docker-compose services
  | 'dockerfile'    // FROM lines
  | 'prisma'        // prisma schema datasource
  | 'orm-config'    // drizzle/sequelize/knex config naming a driver
  | 'workflow'      // GitHub Actions
  | 'sql'           // .sql files
  | 'import'        // an import/require/include line in the student's own code
  | 'file'          // the mere presence of a file or directory

export interface Detection {
  /** The raw token to canonicalize — 'postgres', 'gin', 'PostgreSQL'. */
  raw: string
  source: DetectionSource
  /** Human-readable origin, shown to the student: 'docker-compose.yml'. */
  where: string
}

export function detection(raw: string, source: DetectionSource, where: string): Detection {
  return { raw: raw.trim(), source, where }
}

// ─── docker-compose ──────────────────────────────────────────────────────────

/**
 * Service images from a compose file.
 *
 * A compose file is the closest thing to a plain statement of "here is the
 * infrastructure I ran". `image: postgres:15` is not an inference — the
 * student started a Postgres.
 *
 * Deliberately regex, not a YAML parser: we want the image strings, and
 * pulling a YAML dependency in to read one field would be the tail wagging
 * the dog. The cost is that a compose file using anchors or unusual
 * indentation may yield less; it never yields something wrong.
 */
export function parseComposeServices(content: string, path: string): Detection[] {
  const out: Detection[] = []
  const seen = new Set<string>()

  for (const m of Array.from(content.matchAll(/^\s*image:\s*['"]?([^'"\s]+)['"]?/gm))) {
    // "docker.io/library/postgres:15-alpine" -> "postgres"
    const image = m[1]
    const withoutRegistry = image.split('/').pop() ?? image
    const name = withoutRegistry.split(':')[0].toLowerCase()
    if (!name || seen.has(name)) continue
    seen.add(name)
    out.push(detection(name, 'compose', path))
  }

  // A compose file at all means the student composed containers.
  if (out.length > 0 || /^\s*services:/m.test(content)) {
    out.push(detection('Docker Compose', 'compose', path))
  }
  return out
}

// ─── Dockerfile ──────────────────────────────────────────────────────────────

/**
 * Base images. `FROM node:20` says Node; `FROM nvidia/cuda` says something
 * considerably more specific than "they have a Dockerfile".
 */
export function parseDockerfile(content: string, path: string): Detection[] {
  const out: Detection[] = [detection('Docker', 'dockerfile', path)]
  const seen = new Set<string>()

  for (const m of Array.from(content.matchAll(/^\s*FROM\s+([^\s]+)/gim))) {
    const image = m[1]
    if (image.startsWith('$')) continue // build-arg indirection, nothing to learn
    const withoutRegistry = image.split('/').pop() ?? image
    const name = withoutRegistry.split(':')[0].toLowerCase()
    if (!name || name === 'scratch' || seen.has(name)) continue
    seen.add(name)
    out.push(detection(name, 'dockerfile', path))
  }

  // Multi-stage builds are a real signal about how the student thinks about
  // images, and they are unambiguous in the text.
  if ((content.match(/^\s*FROM\s+/gim) ?? []).length > 1) {
    out.push(detection('multi-stage Docker build', 'dockerfile', path))
  }
  return out
}

// ─── Prisma ──────────────────────────────────────────────────────────────────

const PRISMA_PROVIDERS: Record<string, string> = {
  postgresql: 'PostgreSQL',
  postgres: 'PostgreSQL',
  mysql: 'MySQL',
  sqlite: 'SQLite',
  sqlserver: 'SQL Server',
  mongodb: 'MongoDB',
  cockroachdb: 'CockroachDB',
}

/**
 * The datasource block states the database outright:
 *
 *   datasource db { provider = "postgresql" }
 *
 * This is the single clearest example of why manifest-only detection was
 * wrong. The dependency is "prisma"; the database is written down one file
 * over, in plain text, and was being ignored.
 */
export function parsePrismaSchema(content: string, path: string): Detection[] {
  const out: Detection[] = [detection('Prisma', 'prisma', path)]
  const m = content.match(/datasource\s+\w+\s*\{[^}]*provider\s*=\s*"([^"]+)"/)
  if (m) {
    const skill = PRISMA_PROVIDERS[m[1].toLowerCase()]
    if (skill) out.push(detection(skill, 'prisma', path))
  }
  // Relations and indexes in a schema are schema *design*, not just usage.
  if (/@relation\b/.test(content)) out.push(detection('data modelling', 'prisma', path))
  return out
}

// ─── Other ORM configs ───────────────────────────────────────────────────────

const DRIVER_HINTS: { pattern: RegExp; skill: string }[] = [
  { pattern: /\b(postgresql|postgres|pg)\b/i, skill: 'PostgreSQL' },
  { pattern: /\bmysql\b/i, skill: 'MySQL' },
  { pattern: /\bsqlite\b/i, skill: 'SQLite' },
  { pattern: /\bmongodb\b/i, skill: 'MongoDB' },
]

/**
 * Drizzle, Knex, Sequelize and TypeORM all name their driver in a config
 * file. Only the dialect/driver field is inspected — matching the whole
 * file would hit any stray mention of "postgres" in a comment.
 */
export function parseOrmConfig(content: string, path: string): Detection[] {
  const out: Detection[] = []
  const field = content.match(/(?:dialect|driver|provider|client)\s*[:=]\s*['"]([^'"]+)['"]/i)
  if (!field) return out
  for (const { pattern, skill } of DRIVER_HINTS) {
    if (pattern.test(field[1])) {
      out.push(detection(skill, 'orm-config', path))
      break
    }
  }
  return out
}

// ─── SQL ─────────────────────────────────────────────────────────────────────

/**
 * What a .sql file actually demonstrates.
 *
 * Presence alone means SQL. Beyond that, the statements distinguish someone
 * who wrote queries from someone who designed a schema — CREATE TABLE and
 * CREATE INDEX are design decisions, and dialect-specific syntax names the
 * database even when no driver is installed anywhere.
 */
export function parseSqlFile(content: string, path: string): Detection[] {
  const out: Detection[] = [detection('SQL', 'sql', path)]

  if (/\bcreate\s+table\b/i.test(content)) out.push(detection('database schema design', 'sql', path))
  if (/\bcreate\s+(unique\s+)?index\b/i.test(content)) out.push(detection('database indexing', 'sql', path))
  if (/\bcreate\s+(or\s+replace\s+)?(function|trigger|procedure)\b/i.test(content)) {
    out.push(detection('stored procedures', 'sql', path))
  }

  // Dialect tells: these do not exist outside Postgres.
  if (/\b(jsonb|serial\s+primary\s+key|returning\b|plpgsql|tsvector|gen_random_uuid|row\s+level\s+security)\b/i.test(content)) {
    out.push(detection('PostgreSQL', 'sql', path))
  }
  if (/\b(auto_increment|engine\s*=\s*innodb)\b/i.test(content)) {
    out.push(detection('MySQL', 'sql', path))
  }

  return out
}

// ─── Terraform ───────────────────────────────────────────────────────────────

const TF_PROVIDER_SKILL: Record<string, string> = {
  aws: 'AWS', google: 'Google Cloud', azurerm: 'Azure',
  kubernetes: 'Kubernetes', docker: 'Docker', cloudflare: 'Cloudflare',
}

export function parseTerraform(content: string, path: string): Detection[] {
  const out: Detection[] = [detection('Terraform', 'file', path)]
  const seen = new Set<string>()
  // resource "aws_s3_bucket" "x" — the prefix before the first underscore
  // is the provider.
  for (const m of Array.from(content.matchAll(/^\s*(?:resource|data)\s+"([a-z0-9]+)_/gim))) {
    const provider = m[1].toLowerCase()
    if (seen.has(provider)) continue
    seen.add(provider)
    const skill = TF_PROVIDER_SKILL[provider]
    if (skill) out.push(detection(skill, 'file', path))
  }
  return out
}

// ─── GitHub Actions ──────────────────────────────────────────────────────────

/**
 * A workflow file means CI. What it *does* is more interesting: a deploy
 * step, a matrix build, a container build.
 */
export function parseWorkflow(content: string, path: string): Detection[] {
  const out: Detection[] = [detection('CI/CD', 'workflow', path)]
  if (/^\s*strategy:/m.test(content) && /^\s*matrix:/m.test(content)) {
    out.push(detection('CI matrix builds', 'workflow', path))
  }
  if (/docker\/build-push-action|docker\s+build/i.test(content)) {
    out.push(detection('Docker', 'workflow', path))
  }
  if (/\bterraform\b/i.test(content)) out.push(detection('Terraform', 'workflow', path))
  if (/\bkubectl\b|\bhelm\b/i.test(content)) out.push(detection('Kubernetes', 'workflow', path))
  return out
}

// ─── Imports in the student's own source ─────────────────────────────────────

/**
 * Import lines from source the student actually touched.
 *
 * This is the catch-all for everything a manifest misses: standard-library
 * modules that are never declared anywhere, packages installed but not
 * committed to a manifest, and every C/C++ project where the manifest
 * concept barely exists.
 *
 * Scoped to files the student's own commits touched, so an import in a
 * teammate's file doesn't become the student's skill. Relative imports are
 * dropped — './utils' is the project's own code, not a library.
 */
export function extractImports(content: string, path: string): Detection[] {
  const modules = new Set<string>()

  const patterns: RegExp[] = [
    /^\s*import\s+(?:[\w*{},\s]+\s+from\s+)?['"]([^'"]+)['"]/gm,   // JS/TS
    /^\s*(?:const|let|var)\s+.*=\s*require\(\s*['"]([^'"]+)['"]/gm, // CommonJS
    /^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/gm,         // Python
    /^\s*#include\s*[<"]([^>"]+)[>"]/gm,                            // C/C++
    /^\s*use\s+([a-z0-9_]+)(?:::|;)/gm,                             // Rust
    /^\s*import\s+(?:static\s+)?([a-z][\w.]*)\s*;/gm,               // Java
  ]

  for (const pattern of patterns) {
    for (const m of Array.from(content.matchAll(pattern))) {
      const raw = (m[1] ?? m[2] ?? '').trim()
      if (!raw) continue
      if (raw.startsWith('.') || raw.startsWith('/') || raw.startsWith('@/')) continue // own code
      modules.add(topLevelModule(raw))
    }
  }

  return Array.from(modules)
    .filter((m) => m.length > 1)
    .map((m) => detection(m, 'import', path))
}

/**
 * The part of an import path that names the library.
 *
 * 'react-dom/client' -> 'react-dom', '@tanstack/react-query' -> the scoped
 * package (both halves matter for a scope), 'os.path' -> 'os',
 * 'java.util.concurrent' -> 'java.util.concurrent' (kept whole, since the
 * package IS the meaningful unit in Java and 'java' alone says nothing).
 */
function topLevelModule(raw: string): string {
  if (raw.startsWith('@')) {
    const parts = raw.split('/')
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : raw
  }
  if (raw.startsWith('java.') || raw.startsWith('javax.')) return raw
  if (raw.includes('/')) return raw.split('/')[0]
  if (raw.includes('.')) return raw.split('.')[0]
  return raw
}
