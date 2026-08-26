import { describe, it, expect } from 'vitest'
import {
  isStudentAuthored, languageOf, readFile, TEST_PATH, VENDORED_PATH,
} from '../src/lib/github/code-signals'
import {
  computeLanguageShare, computeSkillRelevance, scaleComposite, EVIDENCE_THRESHOLD,
} from '../src/lib/skills/relevance'
import { extractComplexity } from '../src/lib/github/complexity'
import type { RepoScanResult } from '../src/lib/github/scan'
import type { Detection } from '../src/lib/github/detectors'

const det = (raw: string, source: Detection['source'], where: string): Detection => ({ raw, source, where })

// A scan result with everything neutral, so each test can move one thing and
// see what it does to the score.
function scan(over: Partial<RepoScanResult> = {}): RepoScanResult {
  return {
    repoFullName: 'a/b', skip: false, defaultBranch: 'main', isFork: false,
    languages: {}, detections: [], sampledSources: [],
    activeDays: 1, spanDays: 0, revisitRate: null,
    studentCommitCount: 5, totalCommitCount: 5, fractionAuthored: 1,
    distinctContributors: 1, firstCommitAt: null, lastCommitAt: null,
    filesTouchedByStudent: [], hasTests: false, hasCi: false,
    hasDockerfile: false, hasInfraConfig: false,
    ...over,
  }
}

describe('per-language reading', () => {
  it('counts what each language actually uses to define things', () => {
    // Python has no `export`; Go has no `def`. The old single pattern set
    // scored one of them at zero for no reason connected to skill.
    expect(readFile('a.py', 'def handle(x):\n    return x\n\nclass Thing:\n    pass\n').abstractions).toBe(2)
    expect(readFile('a.go', 'func Handle(w http.ResponseWriter) {\n}\ntype Server struct {\n}\n').abstractions).toBe(2)
    expect(readFile('a.rs', 'pub fn run() {}\nstruct Config {}\ntrait Store {}\n').abstractions).toBe(3)
    expect(readFile('a.ts', 'export function run() {}\nexport class A {}\ninterface B {}\n').abstractions).toBe(3)
  })

  it('does not treat Go\'s if err != nil as error handling', () => {
    // It's in every Go program; counting it would just measure how much Go
    // there is. Deliberate handling — wrapping, recovering — does count.
    const boilerplate = readFile('a.go', 'if err != nil {\n  return err\n}\n'.repeat(5))
    expect(boilerplate.errorHandling).toBe(0)

    const deliberate = readFile('a.go', 'return fmt.Errorf("reading %s: %w", name, err)\ndefer func() { recover() }()\n')
    expect(deliberate.errorHandling).toBeGreaterThan(0)
  })

  it('reads nesting off the left margin, in the language\'s own indent width', () => {
    const flat = readFile('a.py', 'x = 1\ny = 2\nz = 3\n')
    const nested = readFile('a.py', 'def f():\n    if x:\n        for y in z:\n            return y\n')
    expect(nested.meanNesting).toBeGreaterThan(flat.meanNesting)
    expect(nested.maxNesting).toBe(3)
  })

  it('caps runaway nesting so one horror show does not outrank good structure', () => {
    const horror = readFile('a.py', ' '.repeat(80) + 'x = 1\n')
    expect(horror.maxNesting).toBeLessThanOrEqual(8)
  })

  it('maps file extensions to languages', () => {
    expect(languageOf('src/a.tsx')).toBe('js')
    expect(languageOf('main.go')).toBe('go')
    expect(languageOf('lib.rs')).toBe('rust')
    expect(languageOf('README.md')).toBe('other')
  })
})

describe('what counts as the student\'s own work', () => {
  it('drops vendored and generated paths', () => {
    expect(isStudentAuthored('node_modules/react/index.js')).toBe(false)
    expect(isStudentAuthored('vendor/lib/x.go')).toBe(false)
    expect(isStudentAuthored('dist/bundle.js')).toBe(false)
    expect(isStudentAuthored('package-lock.json')).toBe(false)
    expect(isStudentAuthored('go.sum')).toBe(false)
    expect(isStudentAuthored('api/service_pb2.py')).toBe(false)
    expect(isStudentAuthored('src/app.ts')).toBe(true)
  })

  it('does not mistake a src directory for a vendor one', () => {
    expect(VENDORED_PATH.test('src/build-tools/x.ts')).toBe(false)
    expect(VENDORED_PATH.test('build/x.ts')).toBe(true)
  })

  it('recognises test files across languages', () => {
    for (const p of ['tests/x.py', 'src/a.test.ts', 'spec/b_spec.rb', 'foo_test.go', 'src/AppTest.java']) {
      expect(TEST_PATH.test(p), p).toBe(true)
    }
    expect(TEST_PATH.test('src/latest.ts')).toBe(false)
  })
})

describe('scoring signals', () => {
  it('scores a test suite above a single token test file', () => {
    const token = extractComplexity(scan({
      filesTouchedByStudent: ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts', 'tests/a.test.ts'],
    }), 0)
    const real = extractComplexity(scan({
      filesTouchedByStudent: ['src/a.ts', 'src/b.ts', 'tests/a.test.ts', 'tests/b.test.ts'],
    }), 0)
    expect(real.signals.testRatio).toBeGreaterThan(token.signals.testRatio)
    expect(real.rawComposite).toBeGreaterThan(token.rawComposite)
  })

  it('rewards working across many days over one long evening', () => {
    const oneEvening = extractComplexity(scan({ activeDays: 1 }), 0)
    const sustained = extractComplexity(scan({ activeDays: 14 }), 0)
    expect(sustained.rawComposite).toBeGreaterThan(oneEvening.rawComposite)
  })

  it('distinguishes a sprint from a project returned to over months', () => {
    const sprint = extractComplexity(scan({ activeDays: 10, spanDays: 12 }), 0)
    const sustained = extractComplexity(scan({ activeDays: 10, spanDays: 120 }), 0)
    expect(sustained.rawComposite).toBeGreaterThan(sprint.rawComposite)
  })

  it('rewards coming back to your own code', () => {
    const abandoned = extractComplexity(scan({ revisitRate: 0 }), 0)
    const iterated = extractComplexity(scan({ revisitRate: 0.8 }), 0)
    expect(iterated.rawComposite).toBeGreaterThan(abandoned.rawComposite)
  })

  it('treats unknown revisit rate as neutral, not as zero', () => {
    // Too little history to judge is not the same as evidence of abandoning
    // it — a three-commit project shouldn't be punished for being small.
    const unknown = extractComplexity(scan({ revisitRate: null }), 0)
    const known0 = extractComplexity(scan({ revisitRate: 0 }), 0)
    expect(unknown.rawComposite).toBeGreaterThan(known0.rawComposite)
  })

  it('counts nesting, not raw branch keywords', () => {
    const flat = extractComplexity(scan({
      sampledSources: [{ path: 'a.ts', content: 'const a = 1 && 2 || 3\nif (a) {}\nif (a) {}\nif (a) {}\n' }],
    }), 0)
    const structured = extractComplexity(scan({
      sampledSources: [{ path: 'a.ts', content: 'function f() {\n  if (x) {\n    for (const y of z) {\n      g(y)\n    }\n  }\n}\n' }],
    }), 0)
    expect(structured.signals.nestingDepth).toBeGreaterThan(flat.signals.nestingDepth)
  })
})

describe('per-skill relevance', () => {
  const noLangs = new Map()

  it('scores something you imported far above something only in a config', () => {
    const imported = computeSkillRelevance({
      detections: [det('tokio', 'import', 'src/main.rs'), det('tokio', 'import', 'src/net.rs')],
      filesTouched: new Set(['src/main.rs', 'src/net.rs']),
      languageShare: noLangs,
    })
    const configOnly = computeSkillRelevance({
      detections: [det('react', 'manifest', 'package.json')],
      filesTouched: new Set(['src/main.rs']),
      languageShare: noLangs,
    })
    expect(imported.relevance).toBeGreaterThan(configOnly.relevance)
  })

  it('keeps an incidental dependency out of the record entirely', () => {
    // The case that started this: a Rust project with a package.json in it
    // should not claim the student knows React.
    const { relevance } = computeSkillRelevance({
      detections: [det('react', 'manifest', 'package.json')],
      filesTouched: new Set(['src/main.rs', 'src/lib.rs']),
      languageShare: noLangs,
    })
    expect(relevance).toBeLessThan(EVIDENCE_THRESHOLD + 0.001)
  })

  it('counts a config the student actually edited much higher', () => {
    const { relevance } = computeSkillRelevance({
      detections: [det('postgres', 'compose', 'docker-compose.yml')],
      filesTouched: new Set(['docker-compose.yml']),
      languageShare: noLangs,
    })
    expect(relevance).toBeGreaterThan(EVIDENCE_THRESHOLD)
  })

  it('weights a language by how much of their work is in it', () => {
    const share = computeLanguageShare(['a.rs', 'b.rs', 'c.rs', 'd.rs', 'e.ts'])
    const rust = computeSkillRelevance({
      detections: [det('Rust', 'language', 'GitHub language stats')],
      filesTouched: new Set(), languageShare: share,
    })
    const ts = computeSkillRelevance({
      detections: [det('TypeScript', 'language', 'GitHub language stats')],
      filesTouched: new Set(), languageShare: share,
    })
    expect(rust.relevance).toBeGreaterThan(ts.relevance)
  })

  it('excludes test files from the language split', () => {
    // A repo that's half tests shouldn't halve every language's share.
    const share = computeLanguageShare(['a.py', 'tests/a_test.py', 'tests/b_test.py'])
    expect(share.get('python')).toBe(1)
  })

  it('marks a library used only in tests as real but secondary', () => {
    const { relevance, reason } = computeSkillRelevance({
      detections: [det('pytest', 'import', 'tests/test_api.py')],
      filesTouched: new Set(['tests/test_api.py']),
      languageShare: noLangs,
    })
    expect(relevance).toBeGreaterThan(EVIDENCE_THRESHOLD)
    expect(relevance).toBeLessThan(0.75)
    expect(reason).toContain('test')
  })

  it('lets an implied skill inherit from its cause', () => {
    const { relevance, reason } = computeSkillRelevance({
      detections: [], filesTouched: new Set(), languageShare: noLangs,
      impliedFrom: { skillId: 'supabase-platform', relevance: 0.9 },
    })
    expect(relevance).toBeGreaterThan(EVIDENCE_THRESHOLD)
    expect(reason).toContain('supabase-platform')
  })

  it('never drops an implied skill below the evidence bar', () => {
    // Postgres reached via Supabase is a real claim even when the Supabase
    // detection itself was weak — it should not silently vanish.
    const { relevance } = computeSkillRelevance({
      detections: [], filesTouched: new Set(), languageShare: noLangs,
      impliedFrom: { skillId: 'supabase-platform', relevance: 0.1 },
    })
    expect(relevance).toBeGreaterThanOrEqual(EVIDENCE_THRESHOLD)
  })
})

describe('scaleComposite', () => {
  it('separates the main skill from the incidental one', () => {
    const repo = 100
    expect(scaleComposite(repo, 1)).toBeGreaterThan(scaleComposite(repo, 0.3))
  })

  it('keeps a floor — peripheral is not worthless', () => {
    // They still did work in a repo of this difficulty; the surrounding
    // complexity is part of what they dealt with.
    expect(scaleComposite(100, 0)).toBeGreaterThan(0)
    expect(scaleComposite(100, 0)).toBeLessThan(scaleComposite(100, 1))
  })

  it('never exceeds the repo\'s own difficulty', () => {
    expect(scaleComposite(100, 1)).toBeLessThanOrEqual(100)
    expect(scaleComposite(100, 5)).toBeLessThanOrEqual(100) // clamped
  })
})
