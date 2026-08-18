// Anthropic client + the agent_calls audit wrapper.
//
// THE RULE THIS FILE ENFORCES: agents never decide (§2). Every agent in
// this product suggests; a human confirms. The posting agent proposes
// skills the poster then edits and approves; the brief agent writes a
// private document only its own student sees. Nothing an agent emits
// reaches another user's record, another user's screen, or a matching
// computation without a person having said yes in between.
//
// agent_calls is what proves that after the fact. Every invocation logs
// its input, its output, and the model version, so "why did it say that"
// is answerable months later — and so an agent that quietly started
// deciding something would be visible in the log rather than inferred
// from behavior.

import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'

// These agents are I/O adapters (draft a listing, write a brief) with a
// fixed output schema — structured extraction/generation, not open-ended
// reasoning. Sonnet 5 handles that as well as Opus at roughly half the
// cost; swap to 'claude-haiku-4-5' for max savings or 'claude-opus-4-8' if
// quality ever regresses. Thinking is disabled below (see create call).
export const AGENT_MODEL = 'claude-sonnet-5'

// Non-streaming ceiling. Both agents emit a small structured object, so
// this is pure headroom: thinking is disabled on the request, so max_tokens
// caps only the JSON output and a structured response is never truncated.
const MAX_TOKENS = 16000

export type AgentType = 'posting' | 'brief' | 'goals' | 'application_scoring'

let cached: Anthropic | null = null

/** Null when no key is configured — callers degrade instead of erroring. */
export function getAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null
  if (!cached) cached = new Anthropic()
  return cached
}

export function agentsAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY
}

export interface StructuredCallArgs {
  agentType: AgentType
  system: string
  userContent: string
  /** JSON Schema. Objects need additionalProperties:false and `required`. */
  schema: Record<string, unknown>
  /** Logged as the call's input alongside the prompt. */
  inputForAudit: Record<string, unknown>
  studentId?: string
  posterId?: string
}

/**
 * One structured call, logged. Returns null when no key is configured so
 * every caller has to handle the agent being absent — the product works
 * without agents, and a missing key must degrade rather than 500.
 *
 * The audit insert is best-effort: a logging failure is loud in the
 * server log but doesn't fail the user's request. Unlike disclosure_log,
 * nothing here is a disclosure to a third party — the output goes back
 * to the person who asked for it.
 */
export async function callStructuredAgent<T>(
  supabase: SupabaseClient,
  args: StructuredCallArgs,
): Promise<T | null> {
  const client = getAnthropic()
  if (!client) return null

  const response = await client.messages.create({
    model: AGENT_MODEL,
    max_tokens: MAX_TOKENS,
    // Structured drafting doesn't need reasoning; Sonnet 5 runs adaptive
    // thinking by default when omitted, so disable it explicitly to keep
    // these calls cheap and their token use predictable.
    thinking: { type: 'disabled' },
    system: args.system,
    output_config: { format: { type: 'json_schema', schema: args.schema } },
    messages: [{ role: 'user', content: args.userContent }],
  })

  // Safety classifiers can decline; content is empty or partial then.
  // Checked before reading content, which would otherwise throw.
  if (response.stop_reason === 'refusal') {
    console.error('[agents] request refused:', response.stop_details)
    return null
  }
  if (response.stop_reason === 'max_tokens') {
    console.error('[agents] hit max_tokens — output is truncated, discarding')
    return null
  }

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  let parsed: T
  try {
    parsed = JSON.parse(text) as T
  } catch (err) {
    console.error('[agents] response was not valid JSON:', err)
    return null
  }

  const { error } = await supabase.from('agent_calls').insert({
    agent_type: args.agentType,
    student_id: args.studentId ?? null,
    poster_id: args.posterId ?? null,
    input: { ...args.inputForAudit, system: args.system, user: args.userContent },
    output: parsed as Record<string, unknown>,
    model_version: AGENT_MODEL,
  })
  if (error) console.error('[agents] agent_calls insert failed:', error)

  return parsed
}
