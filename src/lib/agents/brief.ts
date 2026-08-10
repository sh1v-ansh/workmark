// The brief agent: the cold-start unblock.
//
// A student with no evidence has a circular problem — they can't be
// competitive for a listing without demonstrated skills, and the fastest
// way to demonstrate a skill is to build something. This writes them a
// concrete, scoped project to build, targeting a specific skill.
//
// It is NEVER a listing (project_briefs is a separate table for exactly
// this reason). It's private to the student, regenerable, and nobody else
// ever sees it. That matters: a generated project posted as real work
// would put agent output into another student's matching decisions, which
// is the line §2 draws.
//
// The brief is also deliberately NOT evidence. Completing it produces a
// repo, and the repo produces evidence through the normal scan — the same
// path as any other project. Nothing here writes to skill_evidence.

import type { SupabaseClient } from '@supabase/supabase-js'
import { callStructuredAgent } from './client'

export interface GeneratedBrief {
  targetSkillId: string
  targetSkillName: string
  title: string
  briefText: string
  difficulty: number
}

const SYSTEM = `You write a short, concrete project brief for a computer science student who wants to demonstrate a specific skill.

Workmark verifies skills by scanning the code a student actually writes — commit-attributed, in repositories they link. So the brief's job is to produce a real repository worth scanning, not a tutorial exercise.

Requirements for a good brief:
- Buildable in the stated time by one person, alone, with no team and no external stakeholder.
- Scoped to a specific working artifact. Not "learn React" but a named thing that runs and does something.
- Genuinely exercises the target skill in a way a scan could see — real usage in real code, not an import and one function call.
- Includes what "done" means, concretely enough that the student can tell when they're finished.
- Not a clone of a well-known tutorial project. Something with at least one non-obvious design decision in it.

Write in second person, plainly, as if briefing a capable peer. No preamble, no encouragement, no restating the task back. Keep it to a few short paragraphs — this is a brief, not a specification.

difficulty is 1 (a weekend) to 5 (several weeks of sustained work).`

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Short name for the project.' },
    brief: { type: 'string', description: 'The brief itself, a few short paragraphs.' },
    difficulty: { type: 'integer', enum: [1, 2, 3, 4, 5] },
  },
  required: ['title', 'brief', 'difficulty'],
  additionalProperties: false,
} as const

interface AgentResponse {
  title: string
  brief: string
  difficulty: number
}

export async function generateBrief(
  supabase: SupabaseClient,
  studentId: string,
  targetSkillId: string,
  targetRole: string | null,
): Promise<GeneratedBrief | null> {
  const { data: skill } = await supabase
    .from('skills')
    .select('id, canonical_name')
    .eq('id', targetSkillId)
    .is('deprecated_at', null)
    .maybeSingle()
  if (!skill) throw new Error('Unknown skill.')

  // What they already have, so the brief builds on it rather than
  // proposing something they've demonstrably already done.
  const { data: evidence } = await supabase
    .from('current_skill_evidence')
    .select('skill_id')
    .eq('student_id', studentId)
  const existingIds = Array.from(new Set((evidence ?? []).map((e) => e.skill_id)))
  const { data: existingSkills } = existingIds.length
    ? await supabase.from('skills').select('canonical_name').in('id', existingIds)
    : { data: [] as { canonical_name: string }[] }
  const existingNames = (existingSkills ?? []).map((s) => s.canonical_name)

  const context = [
    `Target skill: ${skill.canonical_name}`,
    targetRole ? `The student is aiming for roles like: ${targetRole}` : null,
    existingNames.length
      ? `They already have verified evidence in: ${existingNames.join(', ')}. Build on these where it makes the project better, but the target skill is what this brief must demonstrate.`
      : 'They have no verified evidence yet — this would be their first project on the platform, so keep the scope achievable.',
  ]
    .filter(Boolean)
    .join('\n')

  const result = await callStructuredAgent<AgentResponse>(supabase, {
    agentType: 'brief',
    studentId,
    system: SYSTEM,
    userContent: context,
    schema: SCHEMA as unknown as Record<string, unknown>,
    inputForAudit: { target_skill_id: targetSkillId, target_role: targetRole, existing_skills: existingNames },
  })

  if (!result) return null

  return {
    targetSkillId: skill.id,
    targetSkillName: skill.canonical_name,
    title: result.title ?? '',
    briefText: result.brief ?? '',
    difficulty: Math.min(5, Math.max(1, Math.round(result.difficulty ?? 3))),
  }
}
