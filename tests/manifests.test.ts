import { describe, it, expect } from 'vitest'
import { parseManifest } from '@/lib/github/manifests'

// These parsers feed canonicalization, which feeds evidence. A parser
// that silently returns [] on a slightly-off file doesn't error — it just
// produces a student with fewer skills than they earned, which is exactly
// the kind of failure nobody notices. Hence the malformed-input cases.

describe('parseManifest — package.json', () => {
  it('extracts dependencies and devDependencies', () => {
    const deps = parseManifest('package.json', JSON.stringify({
      dependencies: { react: '^18.0.0', next: '14.2.0' },
      devDependencies: { vitest: '^4.0.0' },
    }))
    expect(deps).toContain('react')
    expect(deps).toContain('next')
    expect(deps).toContain('vitest')
  })

  it('returns an empty list for malformed JSON rather than throwing', () => {
    expect(parseManifest('package.json', '{ not valid json')).toEqual([])
  })

  it('handles a manifest with no dependency blocks at all', () => {
    expect(parseManifest('package.json', JSON.stringify({ name: 'x', version: '1.0.0' }))).toEqual([])
  })
})

describe('parseManifest — requirements.txt', () => {
  it('strips version specifiers', () => {
    const deps = parseManifest('requirements.txt', 'fastapi==0.110.0\nnumpy>=1.24\npandas')
    expect(deps).toEqual(expect.arrayContaining(['fastapi', 'numpy', 'pandas']))
  })

  it('ignores comments and blank lines', () => {
    const deps = parseManifest('requirements.txt', '# core deps\n\nfastapi==0.110.0\n\n  # trailing note\n')
    expect(deps).toEqual(['fastapi'])
  })
})

describe('parseManifest — pyproject.toml', () => {
  it('extracts dependency names', () => {
    const deps = parseManifest('pyproject.toml', [
      '[project]',
      'name = "thing"',
      'dependencies = [',
      '  "fastapi>=0.110",',
      '  "pydantic",',
      ']',
    ].join('\n'))
    expect(deps).toEqual(expect.arrayContaining(['fastapi', 'pydantic']))
  })
})

describe('parseManifest — go.mod', () => {
  it('extracts module paths from a require block', () => {
    const deps = parseManifest('go.mod', [
      'module example.com/thing',
      'go 1.22',
      'require (',
      '\tgithub.com/gin-gonic/gin v1.9.1',
      '\tgithub.com/stretchr/testify v1.8.4',
      ')',
    ].join('\n'))
    expect(deps.some((d) => d.includes('gin'))).toBe(true)
  })
})

describe('parseManifest — Cargo.toml', () => {
  it('extracts crate names from [dependencies]', () => {
    const deps = parseManifest('Cargo.toml', [
      '[package]',
      'name = "thing"',
      '',
      '[dependencies]',
      'serde = "1.0"',
      'tokio = { version = "1", features = ["full"] }',
    ].join('\n'))
    expect(deps).toEqual(expect.arrayContaining(['serde', 'tokio']))
  })

  it('does not pick up keys from the [package] section', () => {
    const deps = parseManifest('Cargo.toml', '[package]\nname = "thing"\nversion = "0.1.0"\n')
    expect(deps).not.toContain('name')
    expect(deps).not.toContain('version')
  })
})

describe('parseManifest — shared behaviour', () => {
  it('returns an empty list for empty content in every format', () => {
    for (const kind of ['package.json', 'requirements.txt', 'pyproject.toml', 'go.mod', 'Cargo.toml'] as const) {
      expect(parseManifest(kind, '')).toEqual([])
    }
  })
})
