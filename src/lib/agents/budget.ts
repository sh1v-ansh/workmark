// Monthly AI spending limits: one for each person, one for the whole app.
//
// Counted from agent_calls, the same rows the admin cost panel prices, so
// the limit and the bill cannot disagree. Checked in client.ts before every
// model call, which makes it a hard ceiling: a route, a cron job or a new
// agent cannot get round it.
//
// Both fail closed. This is the thing standing between a bug and a bill.

import type { SupabaseClient } from '@supabase/supabase-js'
import { totalCost } from './cost'
import type { AgentType } from './client'

/** The whole app, per calendar month (UTC). */
export const APP_MONTHLY_BUDGET_USD = Number(process.env.AI_MONTHLY_BUDGET_USD ?? 10)

/**
 * One person, per calendar month. Higher than the app budget divided by the
 * user count on purpose: most people use a fraction of theirs, and the app
 * budget is what actually caps the bill.
 */
export const PERSON_MONTHLY_BUDGET_USD = Number(process.env.AI_PERSON_MONTHLY_BUDGET_USD ?? 0.5)

/**
 * Not counted against a person. Checking submitted work is the product
 * working, not a student spending, so it only stops at the app budget.
 */
const EXEMPT_FROM_PERSON: AgentType[] = ['verification', 'taxonomy']

/**
 * Accounts with no AI limits at all: no daily caps, no monthly allowance,
 * and their use is left out of the app total so testing cannot pause AI for
 * everybody else. Set AI_UNLIMITED_EMAILS (comma separated) to change it.
 */
const UNLIMITED_EMAILS = (process.env.AI_UNLIMITED_EMAILS ?? 'shivanshsoni@umass.edu')
  .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)

let unlimitedCache: { at: number; ids: Set<string> } | null = null

/** Account ids for UNLIMITED_EMAILS, looked up in Auth and kept 10 minutes. */
export async function unlimitedIds(supabase: SupabaseClient): Promise<Set<string>> {
  if (UNLIMITED_EMAILS.length === 0) return new Set()
  if (unlimitedCache && Date.now() - unlimitedCache.at < 600_000) return unlimitedCache.ids
  const ids = new Set<string>()
  try {
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
      if (error || !data) break
      for (const u of data.users) if (u.email && UNLIMITED_EMAILS.includes(u.email.toLowerCase())) ids.add(u.id)
      if (data.users.length < 1000 || ids.size === UNLIMITED_EMAILS.length) break
    }
  } catch (err) {
    console.error('[budget] unlimited lookup failed:', err)
  }
  unlimitedCache = { at: Date.now(), ids }
  return ids
}

export async function isUnlimited(supabase: SupabaseClient, userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false
  return (await unlimitedIds(supabase)).has(userId)
}

export interface BudgetResult {
  allowed: boolean
  message?: string
}

function monthStart(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}

const COLUMNS = 'model_version, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, student_id, poster_id'

type Row = {
  model_version: string | null
  input_tokens: number | null
  output_tokens: number | null
  cache_read_tokens: number | null
  cache_write_tokens: number | null
  student_id?: string | null
  poster_id?: string | null
}

function dollars(rows: Row[]): number {
  return totalCost(rows.map((r) => ({
    modelVersion: r.model_version,
    inputTokens: r.input_tokens,
    outputTokens: r.output_tokens,
    cacheReadTokens: r.cache_read_tokens,
    cacheWriteTokens: r.cache_write_tokens,
  }))).dollars
}

// The app-wide total is read at most once a minute per server instance. A
// minute of lag can overshoot by a few calls, which is cents.
let appCache: { at: number; month: string; dollars: number } | null = null

async function appSpend(supabase: SupabaseClient): Promise<number | null> {
  const month = monthStart()
  if (appCache && appCache.month === month && Date.now() - appCache.at < 60_000) return appCache.dollars
  const skip = await unlimitedIds(supabase)
  let total = 0
  // Paged so a busy month cannot hit the row cap and under-count.
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('agent_calls').select(COLUMNS).gte('created_at', month).range(from, from + 999)
    if (error) {
      console.error('[budget] app spend read failed:', error)
      return null
    }
    total += dollars(((data ?? []) as Row[]).filter((r) =>
      !(r.student_id && skip.has(r.student_id)) && !(r.poster_id && skip.has(r.poster_id))))
    if (!data || data.length < 1000) break
  }
  appCache = { at: Date.now(), month, dollars: total }
  return total
}

async function personSpend(supabase: SupabaseClient, column: 'student_id' | 'poster_id', id: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('agent_calls').select(COLUMNS).eq(column, id).gte('created_at', monthStart()).limit(2000)
  if (error) {
    console.error('[budget] person spend read failed:', error)
    return null
  }
  return dollars((data ?? []) as Row[])
}

export async function checkBudget(
  supabase: SupabaseClient,
  args: { agentType: AgentType; studentId?: string | null; posterId?: string | null },
): Promise<BudgetResult> {
  if (await isUnlimited(supabase, args.studentId ?? args.posterId)) return { allowed: true }
  const app = await appSpend(supabase)
  if (app === null) return { allowed: false, message: 'Could not check AI usage right now. Try again in a moment.' }
  if (app >= APP_MONTHLY_BUDGET_USD) {
    console.error(`[budget] app monthly budget reached: $${app.toFixed(2)} of $${APP_MONTHLY_BUDGET_USD}`)
    return { allowed: false, message: 'AI features are paused for the rest of the month. Everything else still works.' }
  }

  if (EXEMPT_FROM_PERSON.includes(args.agentType)) return { allowed: true }
  const column = args.studentId ? 'student_id' : args.posterId ? 'poster_id' : null
  const id = args.studentId ?? args.posterId
  if (!column || !id) return { allowed: true }

  const mine = await personSpend(supabase, column, id)
  if (mine === null) return { allowed: false, message: 'Could not check AI usage right now. Try again in a moment.' }
  if (mine >= PERSON_MONTHLY_BUDGET_USD) {
    return { allowed: false, message: 'You have used this month’s AI allowance. It resets on the 1st.' }
  }
  return { allowed: true }
}
