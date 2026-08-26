// Per-language reading of source files.
//
// The old version ran one set of patterns over every language at once. That
// made the numbers mean different things depending on what you wrote in:
// Go is full of `if err != nil`, so Go looked artificially branchy; Python
// has no `export` keyword, so Python looked like it defined no abstractions
// at all. Same code, different score, for no reason connected to skill.
//
// It also counted raw control-flow density and treated more as better. That
// is at best ambiguous — forty `if`s in one file is as likely to mean
// tangled code as capable code. Nesting depth and error handling are used
// instead: both are real signals, and both are still just pattern matching.
//
// HONEST SCOPING NOTE (unchanged from the original): these remain regex
// approximations, not parsing. Real per-language measurement needs a parser
// per language. What changed is that the patterns now match the language
// they're reading, so the approximation is at least aimed correctly.
//
// What is NOT normalised: the expected *distribution* per language. Knowing
// that Go programs average N abstractions per 100 lines needs data we don't
// have yet. The percentile-within-skill step downstream is what actually
// absorbs that, since a score only has to be right relative to others with
// the same skill.

export type LanguageKey =
  | 'js' | 'python' | 'go' | 'rust' | 'java' | 'c' | 'ruby' | 'php' | 'csharp' | 'swift' | 'other'

interface LanguageProfile {
  /** Defining something reusable — a function, class, type, interface. */
  abstraction: RegExp
  /** Dealing with things going wrong, in this language's idiom. */
  errorHandling: RegExp
  /** Doing more than one thing at a time. */
  concurrency: RegExp
  /** Spaces per indent level, for reading nesting depth off the margin. */
  indentWidth: number
}

const PROFILES: Record<LanguageKey, LanguageProfile> = {
  js: {
    abstraction: /\b(export\s+(async\s+)?function|export\s+(default\s+)?class|export\s+const\s+\w+\s*=\s*(\(|async|function)|interface\s+\w+|type\s+\w+\s*=)/g,
    // A bare `catch` counts, but so does a rejected-promise path and an
    // explicit throw of a typed error — those are handling, not just syntax.
    errorHandling: /\b(try\s*\{|\.catch\s*\(|catch\s*\(|throw\s+new\s+\w+|Promise\.allSettled)\b/g,
    concurrency: /\b(async\s+function|await\s+|Promise\.(all|race|allSettled)|Worker\s*\(|SharedArrayBuffer)\b/,
    indentWidth: 2,
  },
  python: {
    abstraction: /^\s*(def\s+\w+|class\s+\w+|async\s+def\s+\w+)/gm,
    errorHandling: /\b(try\s*:|except\s+\w*|finally\s*:|raise\s+\w+)/g,
    concurrency: /\b(async\s+def|await\s+|asyncio\.|threading\.|multiprocessing\.|concurrent\.futures)/,
    indentWidth: 4,
  },
  go: {
    // Go's error handling is so uniform that counting `if err != nil` would
    // just measure how much Go there is. Only the deliberate parts count:
    // wrapping with context, defining error types, recovering from panic.
    abstraction: /^\s*(func\s+\w+|func\s+\([^)]*\)\s*\w+|type\s+\w+\s+(struct|interface))/gm,
    errorHandling: /\b(fmt\.Errorf|errors\.(New|Is|As|Wrap)|recover\s*\(\)|defer\s+func)/g,
    concurrency: /\b(go\s+func|go\s+\w+\(|chan\s+|sync\.(Mutex|RWMutex|WaitGroup)|select\s*\{)/,
    indentWidth: 1, // gofmt uses tabs; counted as one level each
  },
  rust: {
    abstraction: /^\s*(pub\s+)?(fn\s+\w+|struct\s+\w+|enum\s+\w+|trait\s+\w+|impl\b)/gm,
    // `?` is idiomatic propagation rather than handling, so it isn't counted
    // — match_err, custom error types and explicit recovery are.
    errorHandling: /\b(Result<|Err\s*\(|\.map_err\s*\(|\.unwrap_or_else|panic!|impl\s+std::error::Error)/g,
    concurrency: /\b(async\s+fn|\.await|tokio::|std::thread|Arc<|Mutex<|RwLock<|mpsc::)/,
    indentWidth: 4,
  },
  java: {
    abstraction: /^\s*(public|private|protected)?\s*(static\s+)?(final\s+)?(class|interface|enum|record)\s+\w+|^\s*(public|private|protected)\s+[\w<>\[\],\s]+\s+\w+\s*\(/gm,
    errorHandling: /\b(try\s*\{|catch\s*\(|finally\s*\{|throws\s+\w+|throw\s+new\s+\w+)/g,
    concurrency: /\b(synchronized|ExecutorService|CompletableFuture|Thread\s*\(|ReentrantLock|ConcurrentHashMap|@Async)/,
    indentWidth: 4,
  },
  c: {
    abstraction: /^\s*[\w*]+\s+[\w*]+\s*\([^;)]*\)\s*\{|^\s*(struct|class|typedef|template)\s+\w+/gm,
    errorHandling: /\b(try\s*\{|catch\s*\(|errno|perror|std::(expected|optional)|goto\s+(cleanup|error|fail))/g,
    concurrency: /\b(pthread_|std::thread|std::mutex|std::atomic|#pragma\s+omp|__syncthreads)/,
    indentWidth: 4,
  },
  ruby: {
    abstraction: /^\s*(def\s+\w+|class\s+\w+|module\s+\w+)/gm,
    errorHandling: /\b(begin\b|rescue\b|ensure\b|raise\s+\w+)/g,
    concurrency: /\b(Thread\.new|Mutex\.new|Concurrent::|Async\b)/,
    indentWidth: 2,
  },
  php: {
    abstraction: /^\s*(public|private|protected)?\s*(static\s+)?function\s+\w+|^\s*(class|interface|trait)\s+\w+/gm,
    errorHandling: /\b(try\s*\{|catch\s*\(|finally\s*\{|throw\s+new\s+\w+)/g,
    concurrency: /\b(pcntl_|Swoole|ReactPHP|Amp\\)/,
    indentWidth: 4,
  },
  csharp: {
    abstraction: /^\s*(public|private|protected|internal)?\s*(static\s+)?(async\s+)?(class|interface|record|struct)\s+\w+|^\s*(public|private|protected|internal)\s+[\w<>\[\],\s]+\s+\w+\s*\(/gm,
    errorHandling: /\b(try\s*\{|catch\s*\(|finally\s*\{|throw\s+new\s+\w+)/g,
    concurrency: /\b(async\s+Task|await\s+|Task\.(Run|WhenAll)|lock\s*\(|SemaphoreSlim|ConcurrentDictionary)/,
    indentWidth: 4,
  },
  swift: {
    abstraction: /^\s*(public|private|internal|fileprivate)?\s*(func\s+\w+|class\s+\w+|struct\s+\w+|protocol\s+\w+|enum\s+\w+|extension\s+\w+)/gm,
    errorHandling: /\b(do\s*\{|catch\b|try\?|try!|throws\b|throw\s+\w+)/g,
    concurrency: /\b(async\s+func|await\s+|DispatchQueue|Task\s*\{|actor\s+\w+|@MainActor)/,
    indentWidth: 4,
  },
  other: {
    abstraction: /\b(function\s+\w+|def\s+\w+|class\s+\w+|fn\s+\w+)/g,
    errorHandling: /\b(try|catch|except|rescue|error)\b/g,
    concurrency: /\b(async|await|thread|mutex|concurrent)\b/i,
    indentWidth: 2,
  },
}

const EXTENSION_LANGUAGE: Record<string, LanguageKey> = {
  js: 'js', jsx: 'js', ts: 'js', tsx: 'js', mjs: 'js', cjs: 'js',
  py: 'python',
  go: 'go',
  rs: 'rust',
  java: 'java', kt: 'java', kts: 'java', scala: 'java',
  c: 'c', h: 'c', cpp: 'c', cc: 'c', cxx: 'c', hpp: 'c', cu: 'c',
  rb: 'ruby',
  php: 'php',
  cs: 'csharp',
  swift: 'swift', m: 'swift', mm: 'swift',
}

export function languageOf(path: string): LanguageKey {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return EXTENSION_LANGUAGE[ext] ?? 'other'
}

export interface FileSignals {
  lines: number
  abstractions: number
  errorHandling: number
  hasConcurrency: boolean
  /** Deepest indent level reached, capped — a proxy for how tangled it gets. */
  maxNesting: number
  /** Mean indent level across non-blank lines. Catches sustained complexity. */
  meanNesting: number
}

/**
 * Read one file with the patterns for its own language.
 *
 * Nesting is measured off the left margin rather than by counting braces:
 * it works the same for Python and for C, and it doesn't need a parser. The
 * cap exists because a file with one 12-deep monstrosity in it shouldn't
 * outrank a consistently well-structured one.
 */
export function readFile(path: string, content: string): FileSignals {
  const profile = PROFILES[languageOf(path)]
  const lines = content.split('\n')

  let indentSum = 0
  let maxNesting = 0
  let counted = 0

  for (const line of lines) {
    if (!line.trim()) continue
    // Tabs count as one level each; spaces divide by the language's width.
    const leadingTabs = (line.match(/^\t+/) ?? [''])[0].length
    const leadingSpaces = (line.match(/^ +/) ?? [''])[0].length
    const level = leadingTabs + Math.floor(leadingSpaces / profile.indentWidth)
    const capped = Math.min(level, 8)
    indentSum += capped
    if (capped > maxNesting) maxNesting = capped
    counted++
  }

  return {
    lines: lines.length,
    abstractions: (content.match(profile.abstraction) ?? []).length,
    errorHandling: (content.match(profile.errorHandling) ?? []).length,
    hasConcurrency: profile.concurrency.test(content),
    maxNesting,
    meanNesting: counted > 0 ? indentSum / counted : 0,
  }
}

// ─── What counts as the student's own work ───────────────────────────────────

/**
 * Directories whose contents nobody wrote.
 *
 * The file-picking step already skipped these when choosing config files to
 * read, but the commit-scanning step did not — so a single commit that
 * checked in node_modules added a thousand files to "files this student
 * touched" and inflated every count derived from it.
 */
export const VENDORED_PATH = /(^|\/)(node_modules|vendor|third_party|bower_components|\.venv|venv|env|dist|build|out|target|\.next|\.nuxt|coverage|__pycache__|\.pytest_cache|Pods|Carthage)(\/|$)/

/** Files that exist but weren't written by hand. */
const GENERATED_FILE = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|poetry\.lock|composer\.lock|Gemfile\.lock|go\.sum|\.min\.(js|css)|.*\.generated\.\w+|.*_pb2?\.py|.*\.pb\.go)$/

export function isStudentAuthored(path: string): boolean {
  return !VENDORED_PATH.test(path) && !GENERATED_FILE.test(path)
}

export const TEST_PATH = /(^|\/)(tests?|__tests__|spec|specs)(\/|$)|\.(test|spec)\.\w+$|_test\.\w+$|^test_.*\.py$|Test\w*\.java$/i
