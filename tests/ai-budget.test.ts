import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { checkBudget, APP_MONTHLY_BUDGET_USD, PERSON_MONTHLY_BUDGET_USD } from '../src/lib/agents/budget'

// A call costing `usd` on claude-sonnet-5 ($10 per million output tokens).
const call = (usd: number, who: Record<string, string> = {}) => ({
  model_version: 'claude-sonnet-5', input_tokens: 0, output_tokens: Math.round(usd * 100_000),
  cache_read_tokens: 0, cache_write_tokens: 0, ...who,
})

function fakeDb(rows: ReturnType<typeof call>[], fail = false): SupabaseClient {
  const query = (filter: (r: Record<string, unknown>) => boolean) => {
    const q = {
      select: () => q, gte: () => q, limit: () => Promise.resolve(result()),
      eq: (col: string, v: string) => query((r) => filter(r) && r[col] === v),
      range: (from: number, to: number) => Promise.resolve({ ...result(), data: result().data?.slice(from, to + 1) ?? null }),
    }
    const result = () => (fail ? { data: null, error: { message: 'down' } } : { data: rows.filter(filter), error: null })
    return q
  }
  return { from: () => query(() => true) } as unknown as SupabaseClient
}

describe('checkBudget', () => {
  // Each test gets a fresh module cache window by using distinct totals; the
  // app total is cached for a minute, so these run in an order that only
  // ever raises it.
  it('allows a person under both budgets', async () => {
    const db = fakeDb([call(0.01, { student_id: 's1' })])
    expect((await checkBudget(db, { agentType: 'brief', studentId: 's1' })).allowed).toBe(true)
  })

  it('stops a person over their monthly allowance', async () => {
    const db = fakeDb([call(0.01, { student_id: 's1' }), call(PERSON_MONTHLY_BUDGET_USD, { student_id: 's2' })])
    const r = await checkBudget(db, { agentType: 'brief', studentId: 's2' })
    expect(r.allowed).toBe(false)
    expect(r.message).toMatch(/allowance/)
  })

  it('does not count checking work against a person', async () => {
    const db = fakeDb([call(PERSON_MONTHLY_BUDGET_USD, { student_id: 's2' })])
    expect((await checkBudget(db, { agentType: 'verification', studentId: 's2' })).allowed).toBe(true)
  })

  it('fails closed when usage cannot be read', async () => {
    const db = fakeDb([], true)
    expect((await checkBudget(db, { agentType: 'helper', studentId: 's3' })).allowed).toBe(false)
  })
})

it('app budget is $10 by default', () => {
  expect(APP_MONTHLY_BUDGET_USD).toBe(10)
})
