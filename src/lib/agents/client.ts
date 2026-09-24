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
import { transformJSONSchema } from '@anthropic-ai/sdk/lib/transform-json-schema'
import { UNTRUSTED_BOUNDARY } from './untrusted'
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

// 'application_scoring' is deliberately absent. It was reserved once and
// never built: applications are scored by plain matching code — skill depth
// against listing requirements — with no model involved, and that is the
// right design for the one decision on this platform that affects whether
// somebody gets work. A reserved name for an agent that does not exist is
// how a reader concludes the opposite.
export type AgentType =
  | 'posting' | 'brief' | 'goals' | 'taxonomy' | 'work_summary' | 'planner' | 'verification'
  | 'retro' | 'kickoff' | 'helper'

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
/**
 * The same call, plus the id of the audit row it wrote.
 *
 * `task_submissions.agent_call_id` has existed since the verification
 * migration and nothing ever filled it, because the only way to get a call id
 * was to guess — look up "the most recent call by this student", which
 * planner.ts still does and which two concurrent runs would get wrong.
 *
 * A verdict that cannot be traced to the exact prompt and response that
 * produced it is a verdict a student cannot argue with, and arguing with it
 * is a right rather than a courtesy here. So the id comes back.
 *
 * callStructuredAgent stays as it was — five other agents use it and none of
 * them needs the id.
 */
export async function callStructuredAgentLogged<T>(
  supabase: SupabaseClient,
  args: StructuredCallArgs,
): Promise<{ value: T; callId: string | null } | null> {
  return callInternal<T>(supabase, args)
}

export async function callStructuredAgent<T>(
  supabase: SupabaseClient,
  args: StructuredCallArgs,
): Promise<T | null> {
  const logged = await callInternal<T>(supabase, args)
  return logged ? logged.value : null
}

async function callInternal<T>(
  supabase: SupabaseClient,
  args: StructuredCallArgs,
): Promise<{ value: T; callId: string | null } | null> {
  const client = getAnthropic()
  if (!client) return null

  // Every failure mode of this call has to come back as null rather than as a
  // throw. An Anthropic error escaping here propagates out of whatever route
  // called it, Next turns it into an HTML 500, and the client's `res.json()`
  // then fails — so the browser shows a generic fallback and the actual cause
  // reaches nobody. That is how a rate limit, an overloaded model and a
  // malformed schema all became the same unreadable error.
  //
  // Routes already handle null: they return a 502 with a sentence somebody can
  // read. This makes that path the only one.
  let response: Anthropic.Message
  try {
      response = await client.messages.create({
      model: AGENT_MODEL,
      max_tokens: MAX_TOKENS,
      // Structured drafting doesn't need reasoning; Sonnet 5 runs adaptive
      // thinking by default when omitted, so disable it explicitly to keep
      // these calls cheap and their token use predictable.
      thinking: { type: 'disabled' },
      // Cached, because every agent here sends a long fixed system prompt and
      // a short variable user message. A second call of the same kind within
      // the cache window reads the prompt at a fraction of the input rate, and
      // agent_calls records cache_read_tokens separately so the saving is
      // visible rather than assumed.
      //
      // A block, not a string, because only the block form takes cache_control.
      // The boundary is appended here rather than in each agent so a new agent
      // cannot ship without it — see untrusted.ts for what it says and why —
      // and it stays inside the cached block so the cache key covers it.
      system: [
      {
        type: 'text' as const,
        text: args.system + UNTRUSTED_BOUNDARY,
        cache_control: { type: 'ephemeral' as const },
      },
      ],
      // Put through the SDK's own transform rather than sent as written.
    //
    // Structured outputs supports a narrow slice of JSON Schema: type,
    // description, title, properties, required, additionalProperties, items,
    // a fixed set of string formats, and minItems when it is 0 or 1. Anything
    // else — maxItems, enum, minimum, maximum, maxLength — is a 400, and the
    // API reports one offending keyword per response, so finding them by
    // deploying is a loop that takes as many round trips as there are
    // mistakes. Two of ours had already shipped that way.
    //
    // transformJSONSchema keeps what is supported and folds the rest into the
    // description, so a constraint still reaches the model as an instruction
    // instead of being silently dropped or rejected. It is the same function
    // the SDK's own zod helper runs, which makes it the authority on what the
    // endpoint accepts rather than a list we would have to keep in sync.
    output_config: {
      format: { type: 'json_schema', schema: transformJSONSchema(args.schema) },
    },
      messages: [{ role: 'user', content: args.userContent }],
    })
  } catch (err) {
    // Logged with everything the API said, because "could not draft a plan" in
    // a browser is not a diagnosis and the server log is the only place the
    // real answer exists.
    if (err instanceof Anthropic.APIError) {
      console.error(
        `[agents] ${args.agentType} call failed: ${err.status} ${err.name} — ${err.message}`,
      )
    } else {
      console.error(`[agents] ${args.agentType} call threw:`, err)
    }
    return null
  }

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

  const { data: logged, error } = await supabase
    .from('agent_calls')
    .insert({
      agent_type: args.agentType,
      student_id: args.studentId ?? null,
      poster_id: args.posterId ?? null,
      input: { ...args.inputForAudit, system: args.system, user: args.userContent },
      output: parsed as Record<string, unknown>,
      model_version: AGENT_MODEL,
      // The API returns these on every response and they were being thrown
      // away, which left the Anthropic dashboard as the only way to answer
      // "are we near the budget" — and it cannot break spend down by agent
      // type, by student, or by the feature that caused it.
      //
      // Cache figures are kept apart from input_tokens rather than summed:
      // they bill at different rates, and folding them together would hide
      // the saving from prompt caching, which is the number worth watching
      // once caching is on. `?? null` rather than `?? 0` because a field the
      // API did not send is unknown, and zero is a claim.
      input_tokens: response.usage?.input_tokens ?? null,
      output_tokens: response.usage?.output_tokens ?? null,
      cache_read_tokens: response.usage?.cache_read_input_tokens ?? null,
      cache_write_tokens: response.usage?.cache_creation_input_tokens ?? null,
    })
    .select('id')
    .maybeSingle()

  // Logged, not thrown. The answer is already computed and paid for; losing
  // its audit row is worth a loud console line, not throwing away a verdict
  // the student is waiting on.
  if (error) console.error('[agents] agent_calls insert failed:', error)

  return { value: parsed, callId: (logged?.id as string | undefined) ?? null }
}

export interface TextCallArgs {
  agentType: AgentType
  system: string
  userContent: string
  inputForAudit: Record<string, unknown>
  studentId?: string
  posterId?: string
  /** Called with each piece of text as the model writes it. */
  onText?: (delta: string) => void
  maxTokens?: number
}

/**
 * A plain-text (markdown) call, streamed.
 *
 * For output a person reads as it arrives: the structured calls above
 * return nothing until the whole JSON object is finished, which for a long
 * answer is ten or twenty seconds of an empty screen. Here every piece of
 * text is handed to onText as it is written, and the full text is returned
 * (and logged to agent_calls like every other call) once it ends.
 *
 * Null on no key, an API error, a refusal or a truncated answer, the same
 * failures the structured path treats as no answer.
 */
export async function streamTextAgent(
  supabase: SupabaseClient,
  args: TextCallArgs,
): Promise<{ text: string; callId: string | null } | null> {
  const client = getAnthropic()
  if (!client) return null

  let message: Anthropic.Message
  try {
    const stream = client.messages.stream({
      model: AGENT_MODEL,
      max_tokens: args.maxTokens ?? 4000,
      thinking: { type: 'disabled' },
      system: [
        {
          type: 'text' as const,
          text: args.system + UNTRUSTED_BOUNDARY,
          cache_control: { type: 'ephemeral' as const },
        },
      ],
      messages: [{ role: 'user', content: args.userContent }],
    })
    if (args.onText) stream.on('text', (delta) => args.onText?.(delta))
    message = await stream.finalMessage()
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error(`[agents] ${args.agentType} stream failed: ${err.status} ${err.name} — ${err.message}`)
    } else {
      console.error(`[agents] ${args.agentType} stream threw:`, err)
    }
    return null
  }

  if (message.stop_reason === 'refusal' || message.stop_reason === 'max_tokens') {
    console.error(`[agents] ${args.agentType} stream ended with ${message.stop_reason}`)
    return null
  }

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  const { data: logged, error } = await supabase
    .from('agent_calls')
    .insert({
      agent_type: args.agentType,
      student_id: args.studentId ?? null,
      poster_id: args.posterId ?? null,
      input: { ...args.inputForAudit, system: args.system, user: args.userContent },
      output: { text },
      model_version: AGENT_MODEL,
      input_tokens: message.usage?.input_tokens ?? null,
      output_tokens: message.usage?.output_tokens ?? null,
      cache_read_tokens: message.usage?.cache_read_input_tokens ?? null,
      cache_write_tokens: message.usage?.cache_creation_input_tokens ?? null,
    })
    .select('id')
    .maybeSingle()
  if (error) console.error('[agents] agent_calls insert failed:', error)

  return { text, callId: (logged?.id as string | undefined) ?? null }
}
