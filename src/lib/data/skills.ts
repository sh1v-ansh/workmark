// Normalized skill taxonomy used by the GitHub dependency-file parser.
// Maps raw package names (across ecosystems) to a canonical display skill.
//
// The parser reads ONLY dependency files — never source code — per spec §5.1.2.

type Ecosystem = 'npm' | 'pypi' | 'cargo' | 'go' | 'rubygems'

interface DepEntry {
  eco: Ecosystem
  skill: string
}

// Extend this table as new packages become common in student repos.
// Keep entries lowercase-keyed; the parser lowercases inputs before lookup.
const RAW: [string, DepEntry][] = [
  // ─── JavaScript / TypeScript (npm) ────────────────────────────────────────
  ['react',                { eco: 'npm', skill: 'React' }],
  ['next',                 { eco: 'npm', skill: 'Next.js' }],
  ['vue',                  { eco: 'npm', skill: 'Vue' }],
  ['nuxt',                 { eco: 'npm', skill: 'Nuxt' }],
  ['svelte',               { eco: 'npm', skill: 'Svelte' }],
  ['@sveltejs/kit',        { eco: 'npm', skill: 'SvelteKit' }],
  ['angular',              { eco: 'npm', skill: 'Angular' }],
  ['express',              { eco: 'npm', skill: 'Express' }],
  ['fastify',              { eco: 'npm', skill: 'Fastify' }],
  ['nestjs',               { eco: 'npm', skill: 'NestJS' }],
  ['@nestjs/core',         { eco: 'npm', skill: 'NestJS' }],
  ['prisma',               { eco: 'npm', skill: 'Prisma' }],
  ['@prisma/client',       { eco: 'npm', skill: 'Prisma' }],
  ['drizzle-orm',          { eco: 'npm', skill: 'Drizzle ORM' }],
  ['typeorm',              { eco: 'npm', skill: 'TypeORM' }],
  ['mongoose',             { eco: 'npm', skill: 'MongoDB' }],
  ['pg',                   { eco: 'npm', skill: 'PostgreSQL' }],
  ['mysql2',               { eco: 'npm', skill: 'MySQL' }],
  ['redis',                { eco: 'npm', skill: 'Redis' }],
  ['ioredis',              { eco: 'npm', skill: 'Redis' }],
  ['@supabase/supabase-js', { eco: 'npm', skill: 'Supabase' }],
  ['firebase',             { eco: 'npm', skill: 'Firebase' }],
  ['stripe',               { eco: 'npm', skill: 'Stripe' }],
  ['@stripe/stripe-js',    { eco: 'npm', skill: 'Stripe' }],
  ['openai',               { eco: 'npm', skill: 'OpenAI' }],
  ['@anthropic-ai/sdk',    { eco: 'npm', skill: 'Anthropic' }],
  ['tailwindcss',          { eco: 'npm', skill: 'Tailwind CSS' }],
  ['jest',                 { eco: 'npm', skill: 'Jest' }],
  ['vitest',               { eco: 'npm', skill: 'Vitest' }],
  ['playwright',           { eco: 'npm', skill: 'Playwright' }],
  ['@playwright/test',     { eco: 'npm', skill: 'Playwright' }],
  ['cypress',              { eco: 'npm', skill: 'Cypress' }],
  ['typescript',           { eco: 'npm', skill: 'TypeScript' }],
  ['graphql',              { eco: 'npm', skill: 'GraphQL' }],
  ['apollo-server',        { eco: 'npm', skill: 'GraphQL' }],
  ['@apollo/client',       { eco: 'npm', skill: 'GraphQL' }],
  ['socket.io',            { eco: 'npm', skill: 'WebSockets' }],
  ['ws',                   { eco: 'npm', skill: 'WebSockets' }],

  // ─── Python (pypi) ────────────────────────────────────────────────────────
  ['django',               { eco: 'pypi', skill: 'Django' }],
  ['flask',                { eco: 'pypi', skill: 'Flask' }],
  ['fastapi',              { eco: 'pypi', skill: 'FastAPI' }],
  ['pyramid',              { eco: 'pypi', skill: 'Pyramid' }],
  ['tornado',              { eco: 'pypi', skill: 'Tornado' }],
  ['sqlalchemy',           { eco: 'pypi', skill: 'SQLAlchemy' }],
  ['psycopg2',             { eco: 'pypi', skill: 'PostgreSQL' }],
  ['psycopg2-binary',      { eco: 'pypi', skill: 'PostgreSQL' }],
  ['asyncpg',              { eco: 'pypi', skill: 'PostgreSQL' }],
  ['pymongo',              { eco: 'pypi', skill: 'MongoDB' }],
  ['redis',                { eco: 'pypi', skill: 'Redis' }],
  ['celery',               { eco: 'pypi', skill: 'Celery' }],
  ['pandas',               { eco: 'pypi', skill: 'pandas' }],
  ['numpy',                { eco: 'pypi', skill: 'NumPy' }],
  ['scipy',                { eco: 'pypi', skill: 'SciPy' }],
  ['scikit-learn',         { eco: 'pypi', skill: 'scikit-learn' }],
  ['tensorflow',           { eco: 'pypi', skill: 'TensorFlow' }],
  ['torch',                { eco: 'pypi', skill: 'PyTorch' }],
  ['transformers',         { eco: 'pypi', skill: 'Hugging Face' }],
  ['openai',               { eco: 'pypi', skill: 'OpenAI' }],
  ['anthropic',            { eco: 'pypi', skill: 'Anthropic' }],
  ['langchain',            { eco: 'pypi', skill: 'LangChain' }],
  ['boto3',                { eco: 'pypi', skill: 'AWS' }],
  ['requests',             { eco: 'pypi', skill: 'Python' }],
  ['pytest',               { eco: 'pypi', skill: 'pytest' }],
  ['streamlit',            { eco: 'pypi', skill: 'Streamlit' }],

  // ─── Rust (cargo) ─────────────────────────────────────────────────────────
  ['tokio',                { eco: 'cargo', skill: 'Rust' }],
  ['actix-web',            { eco: 'cargo', skill: 'Actix' }],
  ['axum',                 { eco: 'cargo', skill: 'Axum' }],
  ['rocket',               { eco: 'cargo', skill: 'Rocket' }],
  ['serde',                { eco: 'cargo', skill: 'Rust' }],
  ['sqlx',                 { eco: 'cargo', skill: 'PostgreSQL' }],
  ['diesel',               { eco: 'cargo', skill: 'Diesel ORM' }],

  // ─── Go ──────────────────────────────────────────────────────────────────
  ['github.com/gin-gonic/gin',      { eco: 'go', skill: 'Gin' }],
  ['github.com/labstack/echo',      { eco: 'go', skill: 'Echo' }],
  ['github.com/gofiber/fiber',      { eco: 'go', skill: 'Fiber' }],
  ['gorm.io/gorm',                  { eco: 'go', skill: 'GORM' }],
  ['github.com/lib/pq',             { eco: 'go', skill: 'PostgreSQL' }],
  ['go.mongodb.org/mongo-driver',   { eco: 'go', skill: 'MongoDB' }],

  // ─── Ruby (rubygems) ──────────────────────────────────────────────────────
  ['rails',                { eco: 'rubygems', skill: 'Rails' }],
  ['sinatra',              { eco: 'rubygems', skill: 'Sinatra' }],
  ['rspec',                { eco: 'rubygems', skill: 'RSpec' }],
]

// Build indexed lookup (per-ecosystem so the same package name in different
// ecosystems doesn't collide).
const TAXONOMY: Record<Ecosystem, Map<string, string>> = {
  npm: new Map(), pypi: new Map(), cargo: new Map(), go: new Map(), rubygems: new Map(),
}
for (const [pkg, entry] of RAW) TAXONOMY[entry.eco].set(pkg.toLowerCase(), entry.skill)

/** Map a package name in a given ecosystem to a canonical skill, or null. */
export function skillFor(eco: Ecosystem, packageName: string): string | null {
  return TAXONOMY[eco].get(packageName.toLowerCase()) ?? null
}

// ─── Dependency-file parsers ────────────────────────────────────────────────
// Each parser returns a list of raw package names. skillFor() maps them.

export function parsePackageJson(contents: string): string[] {
  try {
    const parsed = JSON.parse(contents) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
    return [...Object.keys(parsed.dependencies ?? {}), ...Object.keys(parsed.devDependencies ?? {})]
  } catch {
    return []
  }
}

export function parseRequirementsTxt(contents: string): string[] {
  return contents
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(/[<>=!~;\s]/)[0])
    .filter(Boolean)
}

export function parsePyproject(contents: string): string[] {
  // Extremely simple TOML scanning — we only need dependency identifiers, not
  // full TOML fidelity. Handles both PEP 621 [project.dependencies] and Poetry
  // [tool.poetry.dependencies] styles.
  const pkgs: string[] = []
  const arrayMatch = contents.match(/dependencies\s*=\s*\[([\s\S]*?)\]/)
  if (arrayMatch) {
    for (const raw of arrayMatch[1].split(',')) {
      const cleaned = raw.replace(/["']/g, '').trim().split(/[<>=!~;\s]/)[0]
      if (cleaned) pkgs.push(cleaned)
    }
  }
  const poetrySection = contents.match(/\[tool\.poetry\.dependencies\]([\s\S]*?)(\n\[|$)/)
  if (poetrySection) {
    for (const line of poetrySection[1].split('\n')) {
      const m = line.match(/^\s*([A-Za-z0-9_\-.]+)\s*=/)
      if (m && m[1] !== 'python') pkgs.push(m[1])
    }
  }
  return pkgs
}

export function parseCargoToml(contents: string): string[] {
  const pkgs: string[] = []
  const section = contents.match(/\[dependencies\]([\s\S]*?)(\n\[|$)/)
  if (!section) return pkgs
  for (const line of section[1].split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_\-]+)\s*=/)
    if (m) pkgs.push(m[1])
  }
  return pkgs
}

export function parseGoMod(contents: string): string[] {
  const pkgs: string[] = []
  for (const line of contents.split('\n')) {
    const m = line.match(/^\s*([a-z0-9\-./]+\/[a-z0-9\-./]+)\s+v[0-9]/i)
    if (m) pkgs.push(m[1])
  }
  return pkgs
}

export function parseGemfile(contents: string): string[] {
  const pkgs: string[] = []
  for (const line of contents.split('\n')) {
    const m = line.match(/^\s*gem\s+['"]([^'"]+)['"]/)
    if (m) pkgs.push(m[1])
  }
  return pkgs
}

/**
 * Given a filename and its contents, return the canonical skills evidenced by
 * that file (empty if we don't recognize the file or nothing maps).
 */
export function skillsFromDepFile(filename: string, contents: string): string[] {
  const base = filename.split('/').pop()?.toLowerCase() ?? ''
  let eco: Ecosystem
  let raw: string[]
  switch (base) {
    case 'package.json':      eco = 'npm';      raw = parsePackageJson(contents);     break
    case 'requirements.txt':  eco = 'pypi';     raw = parseRequirementsTxt(contents); break
    case 'pyproject.toml':    eco = 'pypi';     raw = parsePyproject(contents);       break
    case 'cargo.toml':        eco = 'cargo';    raw = parseCargoToml(contents);       break
    case 'go.mod':            eco = 'go';       raw = parseGoMod(contents);           break
    case 'gemfile':           eco = 'rubygems'; raw = parseGemfile(contents);         break
    default: return []
  }
  const seen = new Set<string>()
  for (const pkg of raw) {
    const skill = skillFor(eco, pkg)
    if (skill) seen.add(skill)
  }
  return Array.from(seen)
}

export const DEP_FILE_NAMES = [
  'package.json',
  'requirements.txt',
  'pyproject.toml',
  'Cargo.toml',
  'go.mod',
  'Gemfile',
] as const

// ─── Structural analysis (spec §5.1.1) ────────────────────────────────────
// Given a shallow file/directory listing (top-level + one nested level) and
// the raw manifest contents, classify project type, architecture pattern,
// and maturity signals. Never reads source-code files.

export type ProjectType = 'web-app' | 'api' | 'ml' | 'cli' | 'library' | 'mobile' | 'unknown'
export type Architecture = 'monolith' | 'microservices' | 'serverless' | 'static' | 'unknown'

export interface RepoStructureInput {
  /** File/dir entries at the repo root (names, not full paths). */
  rootEntries: Array<{ name: string; type: 'file' | 'dir' }>
  /** Optional: contents of manifest files if already fetched (lowercased keys). */
  manifests?: Partial<Record<'package.json' | 'requirements.txt' | 'pyproject.toml' | 'cargo.toml' | 'go.mod' | 'gemfile', string>>
  /** Optional: entries under .github/workflows to detect CI presence. */
  workflowsCount?: number
}

export interface RepoProfile {
  projectType: ProjectType
  architecture: Architecture
  hasTests: boolean
  hasCi: boolean
  hasDocker: boolean
  hasDocs: boolean
  hasAuth: boolean
  hasDeployConfig: boolean
}

export function analyzeRepoStructure(input: RepoStructureInput): RepoProfile {
  const names = input.rootEntries.map((e) => e.name.toLowerCase())
  const has = (n: string) => names.includes(n.toLowerCase())
  const hasDir = (n: string) => input.rootEntries.some((e) => e.type === 'dir' && e.name.toLowerCase() === n.toLowerCase())
  const nameMatchesAny = (patterns: RegExp[]) => names.some((n) => patterns.some((p) => p.test(n)))

  // ── Maturity signals ──
  const hasTests = hasDir('tests') || hasDir('test') || hasDir('__tests__') || hasDir('spec')
    || nameMatchesAny([/^.*\.test\.(ts|js|py)$/, /^.*\.spec\.(ts|js|py)$/])
  const hasCi = (input.workflowsCount ?? 0) > 0 || has('.travis.yml') || has('.circleci') || has('azure-pipelines.yml')
  const hasDocker = has('dockerfile') || has('docker-compose.yml') || has('docker-compose.yaml')
  const hasDocs = has('readme.md') || has('readme') || hasDir('docs')
  const hasDeployConfig = has('vercel.json') || has('netlify.toml') || has('render.yaml') || has('fly.toml')
    || has('.dockerignore') || has('kustomization.yaml') || hasDir('k8s') || hasDir('kubernetes')
    || has('serverless.yml') || has('serverless.yaml') || has('sam.yaml') || has('sam.yml')

  const allManifestText = Object.values(input.manifests ?? {}).join('\n').toLowerCase()
  const hasAuth = /(?:^|\s|"|')((?:passport|next-auth|auth0|clerk|firebase-auth|supabase|djangorestframework-simplejwt|flask-login|devise|omniauth)(?:\s|"|:|'))/.test(allManifestText)
    || /(?:^|\s|:|")((jsonwebtoken|jose|pyjwt|jwt))(?:\s|"|:|@)/.test(allManifestText)

  // ── Project type ──
  const isMobile = has('android') || has('ios') || has('podfile') || has('pubspec.yaml') || has('app.json') && has('metro.config.js')
  const isCli = allManifestText.includes('"bin"') && !hasDir('pages') && !hasDir('app')
  const nodeAppSignals = /"(?:react|next|vue|svelte|@sveltejs\/kit|nuxt|angular|astro)"/.test(allManifestText)
  const pyWebSignals = /(?:^|\s|=|>|\n)(django|flask|fastapi|pyramid|tornado)/.test(allManifestText)
  const goApiSignals = /(?:gin|echo|fiber|chi|gorilla\/mux)/.test(allManifestText)
  const rustApiSignals = /(?:axum|actix-web|rocket|warp)/.test(allManifestText)
  const mlSignals = /(?:tensorflow|torch|transformers|scikit-learn|xgboost|jupyter|numpy|pandas|scipy)/.test(allManifestText)
  const staticSignals = has('index.html') && !nodeAppSignals && !pyWebSignals

  let projectType: ProjectType = 'unknown'
  if (isMobile) projectType = 'mobile'
  else if (isCli) projectType = 'cli'
  else if (mlSignals && !nodeAppSignals && !pyWebSignals) projectType = 'ml'
  else if (nodeAppSignals || pyWebSignals) projectType = 'web-app'
  else if (goApiSignals || rustApiSignals) projectType = 'api'
  else if (staticSignals) projectType = 'web-app'
  else if (allManifestText.includes('"main"') || allManifestText.includes('"exports"')) projectType = 'library'

  // ── Architecture pattern ──
  let architecture: Architecture = 'unknown'
  if (hasDir('services') || hasDir('apps') || hasDir('packages')) architecture = 'microservices'
  else if (has('serverless.yml') || has('serverless.yaml') || hasDir('functions') || hasDir('lambda')) architecture = 'serverless'
  else if (staticSignals) architecture = 'static'
  else if (projectType !== 'unknown') architecture = 'monolith'

  return { projectType, architecture, hasTests, hasCi, hasDocker, hasDocs, hasAuth, hasDeployConfig }
}

