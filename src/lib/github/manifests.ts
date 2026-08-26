// Extracts raw dependency-name strings from the manifest files of the most
// common ecosystems in a CS student population. Each parser is
// intentionally lightweight (regex/simple-JSON, not a real TOML/XML parser)
// — good enough to pull dependency names out reliably, not a general-purpose
// manifest parser. Extend the same way for pom.xml/Gemfile/composer.json
// later if they turn out to matter; not built now to keep this a working
// slice across the 4 most likely ecosystems rather than a shallow pass
// across 8.
//
// Output is raw strings ("react", "fastapi") for the caller to canonicalize
// — this module has no opinion on the taxonomy.

export type ManifestKind =
  | 'package.json' | 'requirements.txt' | 'pyproject.toml' | 'go.mod' | 'Cargo.toml'
  | 'pom.xml' | 'build.gradle' | 'Gemfile' | 'composer.json' | 'CMakeLists.txt' | 'csproj'

export const MANIFEST_PATHS: ManifestKind[] = [
  'package.json',
  'requirements.txt',
  'pyproject.toml',
  'go.mod',
  'Cargo.toml',
  'pom.xml',
  'build.gradle',
  'Gemfile',
  'composer.json',
  'CMakeLists.txt',
]

/**
 * Which parser handles a given file path. Used when walking the repo's file
 * list, where a manifest can sit in a subdirectory (a Gradle module, a
 * service in a monorepo) rather than only at the root.
 *
 * Order matters for the suffix checks: `build.gradle.kts` must be tested
 * before a bare `.kts` rule would catch it, and `.csproj` is matched by
 * extension because the file is named after the project, not the tool.
 */
export function manifestKindForPath(path: string): ManifestKind | null {
  const base = path.split('/').pop() ?? ''
  if (base === 'package.json') return 'package.json'
  if (base === 'requirements.txt' || /^requirements.*\.txt$/.test(base)) return 'requirements.txt'
  if (base === 'pyproject.toml') return 'pyproject.toml'
  if (base === 'go.mod') return 'go.mod'
  if (base === 'Cargo.toml') return 'Cargo.toml'
  if (base === 'pom.xml') return 'pom.xml'
  if (base === 'build.gradle' || base === 'build.gradle.kts') return 'build.gradle'
  if (base === 'Gemfile') return 'Gemfile'
  if (base === 'composer.json') return 'composer.json'
  if (base === 'CMakeLists.txt') return 'CMakeLists.txt'
  if (base.endsWith('.csproj') || base.endsWith('.fsproj')) return 'csproj'
  return null
}

export function parseManifest(kind: ManifestKind, content: string): string[] {
  switch (kind) {
    case 'package.json':
      return parsePackageJson(content)
    case 'requirements.txt':
      return parseRequirementsTxt(content)
    case 'pyproject.toml':
      return parsePyprojectToml(content)
    case 'go.mod':
      return parseGoMod(content)
    case 'Cargo.toml':
      return parseCargoToml(content)
    case 'pom.xml':
      return parsePomXml(content)
    case 'build.gradle':
      return parseGradle(content)
    case 'Gemfile':
      return parseGemfile(content)
    case 'composer.json':
      return parseComposerJson(content)
    case 'CMakeLists.txt':
      return parseCMakeLists(content)
    case 'csproj':
      return parseCsproj(content)
  }
}

function parsePackageJson(content: string): string[] {
  try {
    const json = JSON.parse(content)
    const deps = { ...json.dependencies, ...json.devDependencies }
    return Object.keys(deps ?? {})
  } catch {
    return []
  }
}

function parseRequirementsTxt(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('-'))
    // "package==1.2.3", "package>=1.0", "package[extra]", "package ; python_version..."
    .map((line) => line.split(/[=<>!;\[\s]/)[0].trim())
    .filter(Boolean)
}

function parsePyprojectToml(content: string): string[] {
  // Handles the two common shapes: Poetry's [tool.poetry.dependencies]
  // table, and PEP 621's `dependencies = [...]` array. Not a real TOML
  // parser — extracts what it can find via pattern matching.
  const names = new Set<string>()

  const poetrySection = content.match(/\[tool\.poetry\.(?:dev-)?dependencies\]([\s\S]*?)(?=\n\[|$)/g) ?? []
  for (const section of poetrySection) {
    for (const line of section.split('\n')) {
      const m = line.match(/^([A-Za-z0-9_.-]+)\s*=/)
      if (m && m[1].toLowerCase() !== 'python') names.add(m[1])
    }
  }

  const pep621 = content.match(/dependencies\s*=\s*\[([\s\S]*?)\]/)
  if (pep621) {
    const entries = pep621[1].match(/["']([^"']+)["']/g) ?? []
    for (const entry of entries) {
      const name = entry.replace(/["']/g, '').split(/[=<>!;\[\s]/)[0].trim()
      if (name) names.add(name)
    }
  }

  return Array.from(names)
}

function parseGoMod(content: string): string[] {
  const names: string[] = []
  const requireBlock = content.match(/require\s*\(([\s\S]*?)\)/)
  const lines = requireBlock ? requireBlock[1].split('\n') : content.match(/^require\s+.+$/gm) ?? []
  for (const raw of lines) {
    const line = raw.replace(/^require\s+/, '').trim()
    const m = line.match(/^([^\s]+)\s+v/)
    if (m) {
      // Use the last path segment as the "package name" — go modules are
      // import paths (github.com/gin-gonic/gin), and the taxonomy deals in
      // short names, not full paths.
      const segments = m[1].split('/')
      names.push(segments[segments.length - 1])
    }
  }
  return names
}

function parseCargoToml(content: string): string[] {
  const names = new Set<string>()
  const depSections = content.match(/\[dependencies\]([\s\S]*?)(?=\n\[|$)/g) ?? []
  for (const section of depSections) {
    for (const line of section.split('\n')) {
      const m = line.match(/^([A-Za-z0-9_-]+)\s*=/)
      if (m) names.add(m[1])
    }
  }
  return Array.from(names)
}

/**
 * Maven. Takes artifactId rather than groupId — "spring-boot-starter-web"
 * says what was used; "org.springframework.boot" is shared by dozens of
 * unrelated artifacts and canonicalizes to nothing useful.
 */
function parsePomXml(content: string): string[] {
  const names = new Set<string>()
  for (const block of content.match(/<dependency>([\s\S]*?)<\/dependency>/g) ?? []) {
    const artifact = block.match(/<artifactId>\s*([^<\s]+)\s*<\/artifactId>/)
    if (artifact) names.add(artifact[1])
  }
  // Plugins are worth having too — the shade plugin, jacoco, checkstyle all
  // say something real about how the project was built.
  for (const block of content.match(/<plugin>([\s\S]*?)<\/plugin>/g) ?? []) {
    const artifact = block.match(/<artifactId>\s*([^<\s]+)\s*<\/artifactId>/)
    if (artifact) names.add(artifact[1])
  }
  return Array.from(names)
}

/**
 * Gradle, Groovy and Kotlin DSL both. Handles the two shapes that cover
 * almost everything in practice:
 *   implementation 'org.group:artifact:1.2.3'
 *   implementation("org.group:artifact:1.2.3")
 * plus version-catalog references (libs.spring.boot.web), which are
 * increasingly common and would otherwise read as nothing at all.
 */
function parseGradle(content: string): string[] {
  const names = new Set<string>()
  const CONFIGS = 'implementation|api|compileOnly|runtimeOnly|testImplementation|testCompileOnly|annotationProcessor|kapt|ksp|classpath'

  const coordinate = new RegExp(`(?:${CONFIGS})\\s*[( ]\\s*['"]([^'"]+)['"]`, 'g')
  for (const m of Array.from(content.matchAll(coordinate))) {
    const parts = m[1].split(':')
    // group:artifact:version — the artifact is the middle part. A single
    // segment is already a bare name.
    if (parts.length >= 2) names.add(parts[1])
    else if (parts[0]) names.add(parts[0])
  }

  const catalog = new RegExp(`(?:${CONFIGS})\\s*[( ]\\s*libs\\.([A-Za-z0-9_.]+)`, 'g')
  for (const m of Array.from(content.matchAll(catalog))) {
    names.add(m[1].replace(/\./g, '-'))
  }

  // Plugins say as much as dependencies here — the android plugin, the
  // kotlin plugin, spring boot.
  for (const m of Array.from(content.matchAll(/id\s*[( ]\s*['"]([^'"]+)['"]/g))) {
    names.add(m[1])
  }

  return Array.from(names)
}

function parseGemfile(content: string): string[] {
  const names = new Set<string>()
  for (const m of Array.from(content.matchAll(/^\s*gem\s+['"]([^'"]+)['"]/gm))) {
    names.add(m[1])
  }
  return Array.from(names)
}

function parseComposerJson(content: string): string[] {
  try {
    const json = JSON.parse(content)
    const deps = { ...json.require, ...json['require-dev'] }
    const names = new Set<string>()
    for (const key of Object.keys(deps ?? {})) {
      // php and ext-* are platform requirements, not libraries.
      if (key === 'php' || key.startsWith('ext-')) continue
      if (!key.includes('/')) { names.add(key); continue }
      // "vendor/package" — unlike an npm scope, either half can be the
      // meaningful name: laravel/framework is known by its vendor,
      // guzzlehttp/guzzle by its package. Emit both and let
      // canonicalization pick whichever matches the taxonomy.
      const [vendor, pkg] = key.split('/')
      if (vendor) names.add(vendor)
      if (pkg) names.add(pkg)
    }
    return Array.from(names)
  } catch {
    return []
  }
}

/**
 * CMake. There is no dependency list to read, so this pulls the things that
 * actually name a library: find_package, target_link_libraries, and
 * FetchContent declarations. Imperfect by nature — a C++ project's real
 * dependencies are often vendored or system-installed and appear nowhere —
 * but it turns "zero skills" into something for a whole category of repo
 * that previously produced nothing at all.
 */
function parseCMakeLists(content: string): string[] {
  const names = new Set<string>()
  for (const m of Array.from(content.matchAll(/find_package\s*\(\s*([A-Za-z0-9_+-]+)/gi))) names.add(m[1])
  for (const m of Array.from(content.matchAll(/FetchContent_Declare\s*\(\s*([A-Za-z0-9_+-]+)/gi))) names.add(m[1])
  for (const block of Array.from(content.matchAll(/target_link_libraries\s*\(([^)]*)\)/gi))) {
    for (const token of block[1].split(/\s+/)) {
      const clean = token.trim()
      // Skip the target name and CMake's own keywords — what's left is the
      // libraries being linked.
      if (!clean || /^(PUBLIC|PRIVATE|INTERFACE)$/i.test(clean)) continue
      if (clean.includes('${')) continue
      names.add(clean.replace(/^.*::/, ''))
    }
  }
  // The first entry of target_link_libraries is the target itself, which is
  // the project's own name and not a dependency. Cheap to leave in — it
  // canonicalizes to nothing — but dropping obvious project-name noise
  // keeps the raw list honest.
  for (const m of Array.from(content.matchAll(/project\s*\(\s*([A-Za-z0-9_+-]+)/gi))) names.delete(m[1])
  return Array.from(names)
}

function parseCsproj(content: string): string[] {
  const names = new Set<string>()
  for (const m of Array.from(content.matchAll(/<PackageReference\s+Include\s*=\s*"([^"]+)"/g))) names.add(m[1])
  return Array.from(names)
}
