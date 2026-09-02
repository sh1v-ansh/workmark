// The research assistant for unresolved skill names.
//
// It answers the three questions an admin actually has to decide, and it
// never decides any of them:
//
//   1. Is this a skill at all, or tooling / a local file / stdlib?
//   2. If a skill — does an existing taxonomy node already cover it?
//   3. If genuinely new — which existing category is its parent?
//
// Grounded in the package's own registry description rather than the model's
// recollection. "Here is what uvicorn says about itself, classify it" is a
// far more answerable question than "what do you remember about uvicorn", and
// it works for packages published after any training cutoff.
//
// Nothing here writes to a student's record, so a wrong answer costs a
// rejected suggestion and nothing else. That is the entire reason this is
// safe to automate at all.

import type { SupabaseClient } from '@supabase/supabase-js'
import { callStructuredAgent } from './client'
import { lookupPackages, type PackageInfo } from '@/lib/skills/registry'

export type TaxonomyDecision = 'alias_existing' | 'new_skill' | 'not_a_skill'

export interface TaxonomySuggestion {
  rawString: string
  decision: TaxonomyDecision
  /** For alias_existing: the taxonomy id to point at. */
  existingSkillId: string | null
  /** For new_skill: what to call it, and where it belongs. */
  proposedName: string | null
  proposedParentId: string | null
  /** One sentence a reviewer can check, in their own terms. */
  reasoning: string
  confidence: 'high' | 'medium' | 'low'
  /** What the registry said, shown alongside so the reviewer can verify. */
  registry: PackageInfo | null
}

const SYSTEM = `You classify software package names for a skills taxonomy used to describe what computer science students have actually built.

For each name you are given, decide exactly one of:

- "not_a_skill" — build tooling, linters, formatters, type stubs, a standard library module, or something so ubiquitous in its ecosystem that everyone has it. A signal everyone has distinguishes nobody. Prefer this when unsure whether something is really a skill.
- "alias_existing" — the name is a specific library or spelling of a skill the taxonomy already covers. Give the existing skill id. This is the common case and the preferred answer: a taxonomy of 5000 near-duplicate nodes is worse than one of 200, because the same skill fragments across several and matches none of them well.
- "new_skill" — a genuinely distinct, substantial capability the taxonomy has no node for. Reserve this for things a hiring manager would name as a requirement in its own right. Give a proposed display name and the id of an existing category to sit under.

Judge what someone demonstrates by using the thing, not what the thing is. A client library for a database means the database. A web framework's ASGI server means that framework. An icon set means design systems, not a new node.

Be honest in "confidence": "low" when the name is ambiguous or you don't recognise it and the registry gave you nothing. A low-confidence answer is useful; a confidently wrong one wastes a reviewer's trust.

Keep "reasoning" to one short sentence, in plain terms a reviewer can check against the description they can see.`

const SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          decision: { type: 'string', enum: ['alias_existing', 'new_skill', 'not_a_skill'] },
          existing_skill_id: { type: ['string', 'null'] },
          proposed_name: { type: ['string', 'null'] },
          proposed_parent_id: { type: ['string', 'null'] },
          reasoning: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['name', 'decision', 'reasoning', 'confidence'],
        additionalProperties: false,
      },
    },
  },
  required: ['results'],
  additionalProperties: false,
} as const

interface AgentResponse {
  results: {
    name: string
    decision: TaxonomyDecision
    existing_skill_id?: string | null
    proposed_name?: string | null
    proposed_parent_id?: string | null
    reasoning: string
    confidence: 'high' | 'medium' | 'low'
  }[]
}

/**
 * Classify a batch of unresolved names.
 *
 * Batched because the taxonomy has to be sent as context and it is by far the
 * largest part of the prompt — twenty names in one call costs barely more
 * than one, and one call per name would send the taxonomy twenty times.
 */
export async function suggestTaxonomy(
  supabase: SupabaseClient,
  rawStrings: string[],
): Promise<TaxonomySuggestion[]> {
  if (rawStrings.length === 0) return []

  const [{ data: skills }, registry] = await Promise.all([
    supabase.from('skills').select('id, canonical_name, parent_id').is('deprecated_at', null),
    lookupPackages(rawStrings),
  ])
  if (!skills) return []

  // Categories are the nodes nothing else hangs off — the top of the tree.
  const categories = skills.filter((s) => s.parent_id === null)
  const taxonomyList = skills.map((s) => `${s.id}: ${s.canonical_name}`).join('\n')
  const categoryList = categories.map((c) => `${c.id}: ${c.canonical_name}`).join('\n')

  const names = rawStrings.map((raw) => {
    const info = registry.get(raw)
    if (!info) return `- "${raw}" (not found in npm or PyPI)`
    return [
      `- "${raw}" (${info.registry}): ${info.description ?? 'no description published'}`,
      info.keywords.length ? `  keywords: ${info.keywords.join(', ')}` : null,
    ].filter(Boolean).join('\n')
  }).join('\n')

  const userContent = [
    'EXISTING TAXONOMY (id: name)',
    taxonomyList,
    '',
    'CATEGORIES a new skill may sit under',
    categoryList,
    '',
    'NAMES TO CLASSIFY',
    names,
  ].join('\n')

  const result = await callStructuredAgent<AgentResponse>(supabase, {
    agentType: 'taxonomy',
    system: SYSTEM,
    userContent,
    schema: SCHEMA as unknown as Record<string, unknown>,
    inputForAudit: { names: rawStrings },
  })
  if (!result?.results) return []

  const validIds = new Set(skills.map((s) => s.id))
  const validParents = new Set(categories.map((c) => c.id))

  return result.results
    .filter((r) => rawStrings.includes(r.name))
    .map((r) => {
      // The model can hallucinate an id. A suggestion pointing at a skill that
      // doesn't exist would produce a broken alias the moment someone accepted
      // it, so an unknown id is demoted rather than shown as actionable.
      const existing = r.existing_skill_id && validIds.has(r.existing_skill_id)
        ? r.existing_skill_id
        : null
      const parent = r.proposed_parent_id && validParents.has(r.proposed_parent_id)
        ? r.proposed_parent_id
        : null
      const decision: TaxonomyDecision =
        r.decision === 'alias_existing' && !existing ? 'not_a_skill' : r.decision

      return {
        rawString: r.name,
        decision,
        existingSkillId: existing,
        proposedName: r.proposed_name ?? null,
        proposedParentId: parent,
        reasoning: r.reasoning,
        confidence: r.confidence,
        registry: registry.get(r.name) ?? null,
      }
    })
}

/** A url-safe, stable id for a new taxonomy node. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}
