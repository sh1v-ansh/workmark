// What a package actually says about itself.
//
// npm and PyPI both publish free, unauthenticated JSON describing every
// package. Fetching it turns the question we ask the model from "what do you
// remember about `uvicorn`" into "here is uvicorn's own description, classify
// it" — which is more reliable, and works for packages published after any
// training cutoff.
//
// Best-effort throughout: a registry being down or a name not existing is
// ordinary, and the model can still answer from the name alone.

export interface PackageInfo {
  name: string
  registry: 'npm' | 'pypi'
  description: string | null
  keywords: string[]
  homepage: string | null
}

const TIMEOUT_MS = 4000

async function fetchJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    // A 404 is the common case — most strings aren't packages in the
    // registry we happen to try first.
    return null
  }
}

async function fromNpm(name: string): Promise<PackageInfo | null> {
  // The registry's abbreviated document is smaller and cached harder than
  // the full one, but omits keywords — worth the full document here, since
  // keywords are exactly the classification signal we want.
  const data = await fetchJson(`https://registry.npmjs.org/${encodeURIComponent(name)}`)
  if (!data) return null
  return {
    name,
    registry: 'npm',
    description: typeof data.description === 'string' ? data.description : null,
    keywords: Array.isArray(data.keywords) ? (data.keywords as string[]).slice(0, 12) : [],
    homepage: typeof data.homepage === 'string' ? data.homepage : null,
  }
}

async function fromPypi(name: string): Promise<PackageInfo | null> {
  const data = await fetchJson(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`)
  const info = data?.info as Record<string, unknown> | undefined
  if (!info) return null
  return {
    name,
    registry: 'pypi',
    description: typeof info.summary === 'string' ? info.summary : null,
    keywords: typeof info.keywords === 'string'
      ? info.keywords.split(/[,\s]+/).filter(Boolean).slice(0, 12)
      : [],
    homepage: typeof info.home_page === 'string' ? info.home_page : null,
  }
}

/**
 * Look a name up in both registries.
 *
 * Both are tried because the scanner doesn't reliably know which ecosystem a
 * string came from — an import line gives a bare name with no context. Two
 * parallel requests are cheaper than guessing wrong.
 */
export async function lookupPackage(name: string): Promise<PackageInfo | null> {
  const [npm, pypi] = await Promise.all([fromNpm(name), fromPypi(name)])
  // Prefer whichever actually described itself; a bare registry entry with no
  // description tells the model nothing it didn't already have.
  if (npm?.description) return npm
  if (pypi?.description) return pypi
  return npm ?? pypi
}

/** Look several up at once, with bounded concurrency. */
export async function lookupPackages(names: string[]): Promise<Map<string, PackageInfo>> {
  const out = new Map<string, PackageInfo>()
  const CONCURRENCY = 6
  for (let i = 0; i < names.length; i += CONCURRENCY) {
    const batch = names.slice(i, i + CONCURRENCY)
    const found = await Promise.all(batch.map((n) => lookupPackage(n)))
    found.forEach((info, j) => { if (info) out.set(batch[j], info) })
  }
  return out
}
