// Strings that reach the matcher but should never become skills.
//
// The scanner pulls raw names out of manifests and import lines. Most are
// real libraries. A large minority are not skills at all, and were being
// sent to the matcher, failing to match, and piling up in the review queue
// as work for a human who can only ever answer "no, that's not a skill".
//
// Three kinds of noise, all visible in the first real batch of scans:
//
//   Standard library      `os`, `sys`, `json`, `datetime`, `math`, `typing`
//                         `import os` says nothing about anyone's ability.
//
//   The student's own files  `utils`, `models`, `app`, `link`, `type`
//                         A bare import of a sibling module in the same
//                         directory. It looks identical to a package import
//                         and names a file the student wrote.
//
//   Build tooling         `eslint`, `postcss`, `autoprefixer`, `@types/react`
//                         Present in almost every JavaScript project.
//                         Universal presence means zero signal.
//
// Filtered before matching rather than after, so they never reach the
// embedding step (which costs money) or the review queue (which costs
// attention).

/** Python's standard library — the modules that actually show up in student code. */
const PYTHON_STDLIB = new Set([
  '__future__', 'abc', 'argparse', 'ast', 'asyncio', 'base64', 'bisect', 'builtins',
  'calendar', 'collections', 'colorsys', 'concurrent', 'configparser', 'contextlib',
  'copy', 'csv', 'ctypes', 'dataclasses', 'datetime', 'decimal', 'difflib', 'dis',
  'email', 'enum', 'errno', 'functools', 'gc', 'getpass', 'glob', 'gzip', 'hashlib',
  'heapq', 'hmac', 'html', 'http', 'importlib', 'inspect', 'io', 'ipaddress',
  'itertools', 'json', 'logging', 'math', 'mimetypes', 'multiprocessing', 'operator',
  'os', 'pathlib', 'pickle', 'platform', 'pprint', 'queue', 'random', 're', 'secrets',
  'shutil', 'signal', 'socket', 'sqlite3', 'ssl', 'stat', 'string', 'struct',
  'subprocess', 'sys', 'tempfile', 'textwrap', 'threading', 'time', 'timeit',
  'traceback', 'types', 'typing', 'unittest', 'urllib', 'uuid', 'warnings', 'weakref',
  'zipfile', 'zlib',
])

/** Node's built-ins, with and without the `node:` prefix. */
const NODE_BUILTINS = new Set([
  'assert', 'buffer', 'child_process', 'cluster', 'console', 'crypto', 'dns',
  'events', 'fs', 'http', 'http2', 'https', 'net', 'os', 'path', 'perf_hooks',
  'process', 'querystring', 'readline', 'stream', 'string_decoder', 'timers',
  'tls', 'url', 'util', 'v8', 'vm', 'worker_threads', 'zlib',
])

/**
 * C and C++ headers. Note `<vector>` and `<thread>` are dropped as noise even
 * though threading is a real skill — the concurrency signal comes from
 * complexity extraction, which reads how the code uses them, not from the
 * fact that a header was included.
 */
const C_HEADERS = new Set([
  'algorithm', 'array', 'atomic', 'bitset', 'cassert', 'chrono', 'cmath', 'complex',
  'cstdio', 'cstdlib', 'cstring', 'deque', 'exception', 'fstream', 'functional',
  'future', 'iomanip', 'iostream', 'iterator', 'limits', 'list', 'map', 'memory',
  'mutex', 'numeric', 'optional', 'ostream', 'queue', 'random', 'ratio', 'regex',
  'set', 'sstream', 'stack', 'stdexcept', 'stdio.h', 'stdlib.h', 'string', 'string.h',
  'string_view', 'thread', 'tuple', 'type_traits', 'unordered_map', 'unordered_set',
  'utility', 'variant', 'vector',
])

/**
 * Names that are almost always the student's own files.
 *
 * A bare `import utils` in Python, or `from './models'` resolved to `models`,
 * is indistinguishable from a package import by shape alone. These are the
 * words people name their own modules.
 */
const LOCAL_MODULE_NAMES = new Set([
  'app', 'api', 'auth', 'base', 'client', 'common', 'config', 'constants', 'core',
  'db', 'error', 'errors', 'handler', 'handlers', 'helper', 'helpers', 'index',
  'lib', 'link', 'main', 'middleware', 'model', 'models', 'router', 'routes',
  'schema', 'schemas', 'server', 'service', 'services', 'settings', 'setup',
  'state', 'store', 'style', 'styles', 'test', 'tests', 'type', 'types', 'ui',
  'util', 'utils', 'validators', 'views',
])

/**
 * Build and lint tooling.
 *
 * Present in nearly every project of its ecosystem, which is exactly why it
 * carries no information: a signal everyone has distinguishes nobody. Kept
 * separate from the stdlib list because the reasoning is different — these
 * are real packages, they just say nothing.
 */
const TOOLING = new Set([
  'autoprefixer', 'babel', 'concurrently', 'cross-env', 'dotenv', 'eslint',
  'husky', 'lint-staged', 'nodemon', 'npm-run-all', 'postcss', 'prettier',
  'rimraf', 'ts-node', 'tsx', 'typescript-eslint', 'setuptools', 'wheel', 'pip',
  'black', 'flake8', 'isort', 'mypy', 'ruff', 'tqdm', 'python-dotenv',
])

const TOOLING_PREFIXES = [
  '@types/', '@eslint/', 'eslint-', 'prettier-', '@babel/', 'babel-',
  '@typescript-eslint/', 'stylelint',
]

/**
 * Normalize a raw name for comparison.
 *
 * Lowercases, strips scopes and punctuation, so `NumPy`, `numpy` and `num-py`
 * all collapse to the same key. This is what makes an exact match possible
 * where embeddings failed: `numpy` against the taxonomy's `NumPy` scored 70%
 * on similarity, well under the threshold, despite being the same word.
 */
export function normalizeName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^@[^/]+\//, '')        // @scope/pkg -> pkg
    .replace(/^node:/, '')           // node:fs -> fs
    .replace(/\.(h|hpp)$/, '')       // stdio.h -> stdio; NOT .js, or Next.js becomes next
    .replace(/[^a-z0-9+#.]/g, '')    // keep c++, c#, next.js distinguishable
}

/**
 * Should this string be dropped before it reaches the matcher?
 *
 * Dropped silently and not recorded as unresolved — an unresolved entry is a
 * request for a human decision, and there is no decision to make about
 * `import os`.
 */
export function isNoise(raw: string): boolean {
  const n = normalizeName(raw)
  if (!n) return true

  // A single character is never a library name worth recording. Real
  // one-letter skills (R, C) arrive through GitHub's language stats, which
  // is a separate detection source and doesn't pass through here as a bare
  // import.
  if (n.length <= 1) return true

  const lower = raw.trim().toLowerCase()
  if (TOOLING_PREFIXES.some((p) => lower.startsWith(p))) return true

  return (
    PYTHON_STDLIB.has(n) ||
    NODE_BUILTINS.has(n) ||
    C_HEADERS.has(n) ||
    LOCAL_MODULE_NAMES.has(n) ||
    TOOLING.has(n)
  )
}
