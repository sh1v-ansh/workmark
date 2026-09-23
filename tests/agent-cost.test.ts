import { describe, it, expect } from 'vitest'
import { estimateCost, totalCost, cacheHitRate, RATES, type Usage } from '../src/lib/agents/cost'
import { AGENT_MODEL } from '../src/lib/agents/client'

function usage(extra: Partial<Usage> = {}): Usage {
  return {
    inputTokens: null, outputTokens: null,
    cacheReadTokens: null, cacheWriteTokens: null,
    ...extra,
  }
}

describe('estimateCost', () => {
  // The call shape the cost estimate for this product was argued from:
  // roughly 6k in, 1k out on Sonnet. If this number moves, the budget
  // arithmetic in the handoff moves with it.
  it('prices a typical structured call at about two cents', () => {
    const cost = estimateCost('claude-sonnet-5', usage({ inputTokens: 6000, outputTokens: 1000 }))
    expect(cost).toBeCloseTo(0.022, 4)
  })

  it('prices cache reads far below fresh input', () => {
    const fresh = estimateCost('claude-sonnet-5', usage({ inputTokens: 10_000, outputTokens: 0 }))!
    const cached = estimateCost('claude-sonnet-5', usage({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 10_000 }))!
    expect(cached).toBeLessThan(fresh)
    // A tenth, which is the saving the whole conversational design rests on.
    expect(cached).toBeCloseTo(fresh / 10, 6)
  })

  it('charges a premium to write the cache', () => {
    const write = estimateCost('claude-sonnet-5', usage({ inputTokens: 0, outputTokens: 0, cacheWriteTokens: 10_000 }))!
    const fresh = estimateCost('claude-sonnet-5', usage({ inputTokens: 10_000, outputTokens: 0 }))!
    expect(write).toBeGreaterThan(fresh)
  })

  // Rows written before v05_0040 have no token counts. Pricing them as free
  // would make a total that quietly understates.
  it('is null when nothing was recorded', () => {
    expect(estimateCost('claude-sonnet-5', usage())).toBeNull()
  })

  it('is null for a model with no rate on file', () => {
    expect(estimateCost('some-future-model', usage({ inputTokens: 100, outputTokens: 10 }))).toBeNull()
  })

  it('is null when the model is unknown', () => {
    expect(estimateCost(null, usage({ inputTokens: 100, outputTokens: 10 }))).toBeNull()
  })

  // The API omits cache fields entirely when caching was not used, so absent
  // means zero here rather than unknown.
  it('treats absent cache fields as zero once anything was recorded', () => {
    expect(estimateCost('claude-sonnet-5', usage({ inputTokens: 1000, outputTokens: 0 }))).toBeCloseTo(0.002, 6)
  })

  it('has a rate for whichever model the agents actually run', () => {
    expect(RATES[AGENT_MODEL]).toBeDefined()
  })
})

describe('totalCost', () => {
  it('adds up what it can price and counts what it cannot', () => {
    const result = totalCost([
      { modelVersion: 'claude-sonnet-5', ...usage({ inputTokens: 6000, outputTokens: 1000 }) },
      { modelVersion: 'claude-sonnet-5', ...usage({ inputTokens: 6000, outputTokens: 1000 }) },
      { modelVersion: 'claude-sonnet-5', ...usage() },
    ])
    expect(result.dollars).toBeCloseTo(0.044, 4)
    expect(result.priced).toBe(2)
    // The number that stops a total reading as good news when a third of the
    // rows were skipped.
    expect(result.unpriced).toBe(1)
  })

  it('is zero and empty for no calls', () => {
    expect(totalCost([])).toEqual({ dollars: 0, priced: 0, unpriced: 0 })
  })
})

describe('cacheHitRate', () => {
  it('is the share of prompt tokens served from cache', () => {
    const rate = cacheHitRate([usage({ inputTokens: 1000, cacheReadTokens: 9000 })])
    expect(rate).toBeCloseTo(0.9, 6)
  })

  it('is zero when caching is off', () => {
    expect(cacheHitRate([usage({ inputTokens: 5000 })])).toBe(0)
  })

  // Zero out of zero is not a miss rate, and reporting it as 0% would look
  // like caching was on and failing.
  it('is null when no prompt tokens were recorded at all', () => {
    expect(cacheHitRate([usage(), usage()])).toBeNull()
  })
})
