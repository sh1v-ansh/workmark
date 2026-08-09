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

export type ManifestKind = 'package.json' | 'requirements.txt' | 'pyproject.toml' | 'go.mod' | 'Cargo.toml'

export const MANIFEST_PATHS: ManifestKind[] = [
  'package.json',
  'requirements.txt',
  'pyproject.toml',
  'go.mod',
  'Cargo.toml',
]

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
