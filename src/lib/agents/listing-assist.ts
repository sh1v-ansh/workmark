// The posting agent: turns a rough description of a project into a
// draft title, brief, and a set of SUGGESTED required skills.
//
// It suggests. The poster edits and confirms before anything is saved —
// the API route returns a draft, it does not create a listing. This is
// the §2 rule in practice: the agent shapes a proposal, the human makes
// the decision.
//
// The skill suggestion is where an agent could do real damage if trusted
// blindly, because listing_requirements.skill_id is a foreign key AND the
// matching key: a hallucinated ID would either 500 on insert or, worse,
// quietly produce a listing that matches nobody. So the model's returned
// IDs are treated as untrusted input and intersected against the real
// taxonomy server-side. Anything it invents is dropped, not repaired.

import type { SupabaseClient } from '@supabase/supabase-js'
import { callStructuredAgent } from './client'

export interface SuggestedRequirement {
  skillId: string
  canonicalName: string
  requiredLevel: number
  reason: string
}

export interface ListingDraft {
  title: string
  brief: string
  requirements: SuggestedRequirement[]
  /** Skills the model named that don't exist in the taxonomy. Shown to
   *  the poster rather than hidden — a repeatedly-requested missing skill
   *  is a signal the taxonomy needs a node, not a bug to bury. */
  unrecognizedSkills: string[]
}

const SYSTEM = `You help a computer science student write a project listing to find a collaborator on Workmark.

Workmark matches applicants on skills their linked GitHub repositories actually demonstrate — not self-reported ones. So the skills a listing asks for determine who can be matched to it at all.

Write the title and brief in the poster's own register: plain, concrete, first person where natural. No marketing language, no "exciting opportunity", no invented details. If the poster didn't say something, don't add it — an invented requirement or deliverable is worse than a short brief.

For skills, pick only from the provided taxonomy, using the exact id strings given. Choose the skills someone genuinely could not do this work without, plus the ones that would clearly help. Do not pad the list: every skill you add narrows who can be matched, and a listing asking for twelve skills matches nobody.

importance is how much the skill matters to this project (1 nice to have, 3 important, 5 essential). It is NOT a difficulty bar and NOT a years-of-experience proxy — anyone with evidence in a skill can apply regardless.`

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Short, concrete project title.' },
    brief: {
      type: 'string',
      description: 'What the project is, what the collaborator would own, and what done looks like. A few short paragraphs.',
    },
    skills: {
      type: 'array',
      description: 'Required skills, most important first.',
      items: {
        type: 'object',
        properties: {
          skill_id: { type: 'string', description: 'An exact id from the provided taxonomy.' },
          importance: { type: 'integer', enum: [1, 2, 3, 4, 5] },
          reason: { type: 'string', description: 'One short clause on why this project needs it.' },
        },
        required: ['skill_id', 'importance', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'brief', 'skills'],
  additionalProperties: false,
} as const

interface AgentResponse {
  title: string
  brief: string
  skills: { skill_id: string; importance: number; reason: string }[]
}

/**
 * Intersects the model's suggested skills against the real taxonomy.
 *
 * Exported and pure because this is the security boundary: everything
 * the model returns is untrusted, and a hallucinated skill_id would
 * either violate the listing_requirements foreign key or — worse —
 * silently produce a listing that matches nobody. Invented IDs are
 * dropped and reported, never guessed at or fuzzy-matched onto a real
 * node: a wrong-but-plausible correction is harder to notice than an
 * outright omission.
 */
export function validateSuggestedSkills(
  suggested: { skill_id: string; importance: number; reason: string }[],
  validById: Map<string, string>,
): { requirements: SuggestedRequirement[]; unrecognizedSkills: string[] } {
  const requirements: SuggestedRequirement[] = []
  const unrecognizedSkills: string[] = []
  const seen = new Set<string>()

  for (const s of suggested ?? []) {
    const canonicalName = typeof s?.skill_id === 'string' ? validById.get(s.skill_id) : undefined
    if (!canonicalName) {
      if (typeof s?.skill_id === 'string' && s.skill_id) unrecognizedSkills.push(s.skill_id)
      continue
    }
    if (seen.has(s.skill_id)) continue
    seen.add(s.skill_id)
    requirements.push({
      skillId: s.skill_id,
      canonicalName,
      // Clamped rather than trusted: the schema constrains this, but the
      // value lands in a CHECK-constrained column either way, and a
      // non-integer would fail the insert rather than the validation.
      requiredLevel: Math.min(5, Math.max(1, Math.round(Number(s.importance) || 3))),
      reason: typeof s.reason === 'string' ? s.reason : '',
    })
  }

  return { requirements, unrecognizedSkills }
}

export async function draftListing(
  supabase: SupabaseClient,
  posterId: string,
  description: string,
): Promise<ListingDraft | null> {
  const { data: taxonomy, error } = await supabase
    .from('skills')
    .select('id, canonical_name, parent_id')
    .is('deprecated_at', null)
    .order('id')
  if (error) throw error

  const validById = new Map((taxonomy ?? []).map((s) => [s.id, s.canonical_name as string]))

  // The whole taxonomy goes in the prompt — ~180 short lines. Cheaper and
  // far more reliable than letting the model recall skill IDs, which is
  // exactly the kind of thing it would confabulate plausibly.
  const taxonomyList = (taxonomy ?? [])
    .filter((s) => s.parent_id !== null) // leaves only; categories aren't requestable
    .map((s) => `${s.id} — ${s.canonical_name}`)
    .join('\n')

  const result = await callStructuredAgent<AgentResponse>(supabase, {
    agentType: 'posting',
    posterId,
    system: SYSTEM,
    userContent: `Here is the taxonomy of skills you may choose from:\n\n${taxonomyList}\n\n---\n\nThe poster describes their project like this:\n\n${description}`,
    schema: SCHEMA as unknown as Record<string, unknown>,
    inputForAudit: { description, taxonomy_size: validById.size },
  })

  if (!result) return null

  const { requirements, unrecognizedSkills } = validateSuggestedSkills(result.skills ?? [], validById)

  return {
    title: result.title ?? '',
    brief: result.brief ?? '',
    requirements,
    unrecognizedSkills,
  }
}
