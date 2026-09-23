// What a call cost, in dollars.
//
// Pure arithmetic over the token counts agent_calls records, kept out of any
// route so the rates can be checked in a test rather than trusted.
//
// ── These rates are a planning estimate, not a bill ───────────────────────
// Anthropic's prices are not in this repository and change without it. The
// figures below exist so the admin console can say "roughly $14 this week"
// instead of nothing, and so a runaway feature is visible the day it starts
// rather than at the end of the month. The authority on what was actually
// charged is always the Anthropic dashboard, and `estimateCost` is named the
// way it is to keep that distinction in view at the call site.

/** Dollars per million tokens. */
export interface Rate {
  input: number
  output: number
  /** Cached prompt reads, billed at a fraction of the input rate. */
  cacheRead: number
  /** Writing a prompt into the cache, billed at a small premium. */
  cacheWrite: number
}

/**
 * Per model, because the codebase is expected to move between them — the
 * comment on AGENT_MODEL already names haiku and opus as the two directions
 * to go if cost or quality ever forces a change, and a single hardcoded rate
 * would silently misreport the moment somebody took that advice.
 */
export const RATES: Record<string, Rate> = {
  'claude-sonnet-5': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  'claude-haiku-4-5': { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
  'claude-opus-4-8': { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
}

export interface Usage {
  inputTokens: number | null
  outputTokens: number | null
  cacheReadTokens: number | null
  cacheWriteTokens: number | null
}

const PER_MILLION = 1_000_000

/**
 * What one call probably cost.
 *
 * Null for a model with no rate on file, and null rather than zero on
 * purpose: an unpriced model is a number nobody can compute, and returning
 * zero would quietly drop those calls out of a total that is supposed to be
 * a warning. The same goes for the rows written before v05_0040, whose token
 * counts are null because they were never recorded.
 */
export function estimateCost(modelVersion: string | null, usage: Usage): number | null {
  if (!modelVersion) return null
  const rate = RATES[modelVersion]
  if (!rate) return null

  // A call that recorded nothing at all is unknown. A call that recorded some
  // fields and not others is treated as zero for the missing ones, because
  // the API omits cache fields entirely when caching was not used — which
  // means absent, not unknown.
  if (usage.inputTokens === null && usage.outputTokens === null) return null

  return (
    (usage.inputTokens ?? 0) * rate.input +
    (usage.outputTokens ?? 0) * rate.output +
    (usage.cacheReadTokens ?? 0) * rate.cacheRead +
    (usage.cacheWriteTokens ?? 0) * rate.cacheWrite
  ) / PER_MILLION
}

/**
 * Total across many calls, and how many could not be priced.
 *
 * The second number is the point. A total that silently skipped a third of
 * the rows would read as good news, so the count of what it could not price
 * travels with it and the admin console shows both.
 */
export function totalCost(
  calls: (Usage & { modelVersion: string | null })[],
): { dollars: number; priced: number; unpriced: number } {
  let dollars = 0
  let priced = 0
  let unpriced = 0
  for (const call of calls) {
    const cost = estimateCost(call.modelVersion, call)
    if (cost === null) unpriced += 1
    else {
      dollars += cost
      priced += 1
    }
  }
  return { dollars, priced, unpriced }
}

/**
 * How much of the prompt was served from cache, 0 to 1.
 *
 * The one number that says whether caching is doing anything. Null when
 * nothing was read either way, because zero out of zero is not a miss rate.
 */
export function cacheHitRate(calls: Usage[]): number | null {
  let cached = 0
  let fresh = 0
  for (const call of calls) {
    cached += call.cacheReadTokens ?? 0
    fresh += call.inputTokens ?? 0
  }
  if (cached + fresh === 0) return null
  return cached / (cached + fresh)
}
