import { describe, it, expect } from 'vitest'
import { isNoise, normalizeName } from '../src/lib/skills/noise'
import { SEED_ALIASES } from '../src/lib/skills/seed-aliases'

// Every string below came from a real scan's unresolved list. They are the
// regression suite: each one was silently costing a student a skill, or
// wasting a reviewer's attention.

describe('names that were failing similarity but are obviously the same skill', () => {
  // Measured scores from production: numpy/NumPy 70%, docker/Docker 75%,
  // typescript/TypeScript 81%, postgres/PostgreSQL 81%. All correct, all
  // under the 0.85 auto-accept bar.
  it('normalizes to the taxonomy id', () => {
    for (const [raw, id] of [
      ['numpy', 'numpy'], ['NumPy', 'numpy'],
      ['docker', 'docker'], ['Docker', 'docker'],
      ['typescript', 'typescript'], ['TypeScript', 'typescript'],
      ['pandas', 'pandas'], ['kubernetes', 'kubernetes'],
    ] as const) {
      expect(normalizeName(raw), raw).toBe(id)
    }
  })

  it('resolves the rest through the seed table', () => {
    for (const [raw, id] of [
      ['postgres', 'postgresql'], ['html', 'html-css'], ['css', 'html-css'],
      ['torch', 'pytorch'], ['react-dom', 'react'], ['next', 'nextjs'],
      ['shell', 'shell-scripting'], ['pytest', 'unit-testing'],
      ['cuda', 'cuda'], ['nginx', 'load-balancing'], ['axios', 'rest-apis'],
      ['pydantic', 'fastapi'], ['uvicorn', 'fastapi'], ['openai', 'agentic-ai'],
      ['jupyter', 'data-pipelines'], ['statistics', 'statistical-modeling'],
      ['cmake', 'cpp'], ['pybind11', 'cpp'], ['concurrent', 'concurrency'],
      ['requests', 'rest-apis'], ['docker compose', 'docker'],
      ['dockerfile', 'docker'], ['powershell', 'shell-scripting'],
      ['cors', 'rest-apis'], ['lucide-react', 'design-systems'],
      ['asyncio', 'concurrency'],
    ] as const) {
      expect(SEED_ALIASES[normalizeName(raw)], raw).toBe(id)
    }
  })

  it('is case-insensitive throughout', () => {
    expect(SEED_ALIASES[normalizeName('PostgreSQL')]).toBe('postgresql')
    expect(SEED_ALIASES[normalizeName('DOCKER')]).toBe('docker')
    expect(SEED_ALIASES[normalizeName('ReactDOM')]).toBe('react')
  })
})

describe('noise that should never have reached the matcher', () => {
  it('drops the standard library', () => {
    // `import os` says nothing about anyone's ability.
    for (const s of ['os', 'sys', 'json', 'datetime', 'time', 'math', 'random',
                     'typing', 'pathlib', 'collections', 'logging', 'subprocess',
                     'urllib', 'argparse', 'dataclasses', '__future__', 'uuid']) {
      expect(isNoise(s), s).toBe(true)
    }
  })

  it('drops the student\'s own local modules', () => {
    for (const s of ['utils', 'models', 'app', 'link', 'type', 'types', 'config']) {
      expect(isNoise(s), s).toBe(true)
    }
  })

  it('drops build tooling and type stubs', () => {
    for (const s of ['eslint', 'postcss', 'autoprefixer', 'dotenv', 'tqdm',
                     '@types/react', '@types/node', 'eslint-config-next']) {
      expect(isNoise(s), s).toBe(true)
    }
  })

  it('does NOT drop real libraries that merely look small', () => {
    for (const s of ['numpy', 'torch', 'axios', 'redis', 'cuda', 'nginx',
                     'react', 'flask', 'pytest', 'docker']) {
      expect(isNoise(s), s).toBe(false)
    }
  })
})

describe('normalization rules', () => {
  it('strips npm scopes', () => {
    expect(normalizeName('@supabase/supabase-js')).toBe('supabasejs')
    expect(normalizeName('@tanstack/react-query')).toBe('reactquery')
  })

  it('strips node: prefixes and header extensions', () => {
    expect(normalizeName('node:fs')).toBe('fs')
    expect(normalizeName('stdio.h')).toBe('stdio')
  })

  it('keeps the characters that distinguish real skills', () => {
    // c++ and c# must not both collapse to "c".
    expect(normalizeName('C++')).toBe('c++')
    expect(normalizeName('C#')).toBe('c#')
    expect(normalizeName('Next.js')).toBe('next.js')
  })

  it('treats a single character as noise rather than a library', () => {
    expect(isNoise('c')).toBe(true)
    expect(isNoise('r')).toBe(true)
  })
})

describe('the seed table itself', () => {
  it('has no entry whose key is not already normalized', () => {
    // A key that doesn't survive normalizeName can never be looked up.
    for (const key of Object.keys(SEED_ALIASES)) {
      expect(normalizeName(key), key).toBe(key)
    }
  })
})
