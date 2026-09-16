// Writing the two questions a listing asks its applicants.
//
// Runs once, when a listing is posted, so the cost is per listing rather than
// per applicant — a few hundred calls a year rather than one per person who
// clicks Apply. That difference is why this can afford to be a model call at
// all.
//
// The rules it must follow live in lib/applications/questions.ts rather than
// here, so the fallback pair and the generated pair cannot drift into being
// different kinds of question.

import type { SupabaseClient } from '@supabase/supabase-js'
import { callStructuredAgent } from './client'
import { untrusted } from './untrusted'
import { QUESTION_RULES, QUESTION_COUNT, type ApplicationQuestion } from '@/lib/applications/questions'

const SYSTEM = `You write the questions a company asks students applying to a specific software project.

Writing code is no longer what separates applicants — every one of them has a language model open in another tab. What separates them is judgement: deciding what to build, what to cut, what will break, and being willing to commit to an answer rather than covering both sides.

So you are writing ${QUESTION_COUNT} questions that a thoughtful person who has read this brief can answer in under sixty words, and that somebody who skimmed it cannot answer well at all.

${QUESTION_RULES}

Pick two different kinds, from: cut (what would you drop), tradeoff (which approach and what do you give up), risk (what breaks first), assumption (what is missing from the brief), critique (what is wrong with this plan). Two questions of the same kind waste one of them.

For each, also write a one-line hint saying what a good answer contains — a shape, not writing advice. "Name one thing and the risk you accept" is a hint. "Be clear and concise" is not.`

const SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      minItems: QUESTION_COUNT,
      maxItems: QUESTION_COUNT,
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['cut', 'tradeoff', 'risk', 'assumption', 'critique'] },
          prompt: { type: 'string', maxLength: 300 },
          hint: { type: 'string', maxLength: 160 },
        },
        required: ['kind', 'prompt', 'hint'],
        additionalProperties: false,
      },
    },
  },
  required: ['questions'],
  additionalProperties: false,
} as const

interface AgentResponse {
  questions: { kind: string; prompt: string; hint: string }[]
}

/**
 * Two questions for one listing.
 *
 * Null when the agent is unavailable or refuses, and the caller stores
 * nothing — `questionsFor` then serves the fallback pair, which is a good
 * pair rather than a placeholder. A listing must never be unpostable because
 * a model call failed.
 */
export async function writeApplicationQuestions(
  supabase: SupabaseClient,
  posterId: string,
  listing: { title: string; description: string; requirements: string[] },
): Promise<ApplicationQuestion[] | null> {
  const response = await callStructuredAgent<AgentResponse>(supabase, {
    agentType: 'posting',
    system: SYSTEM,
    userContent: [
      untrusted('Project title', listing.title),
      untrusted('What the project is', listing.description),
      listing.requirements.length > 0
        ? untrusted('Skills it needs', listing.requirements.join(', '))
        : 'No specific skills were listed.',
    ].join('\n\n'),
    schema: SCHEMA,
    posterId,
    inputForAudit: { kind: 'application_questions' },
  })

  if (!response?.questions?.length) return null

  return response.questions.slice(0, QUESTION_COUNT).map((q, i) => ({
    id: `q${i}`,
    kind: q.kind as ApplicationQuestion['kind'],
    prompt: q.prompt,
    hint: q.hint,
  }))
}
