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

import { LEVEL_NAMES } from '@/lib/skills/level-names'
import type { SupabaseClient } from '@supabase/supabase-js'
import { streamTextAgent } from './client'
import { parseBriefMarkdown } from '@/lib/briefs/parse'
import { untrusted } from './untrusted'
import {
  CAREER_TRACK_META, SKILL_LEVEL_META,
  type CareerTrack, type SkillLevel,
} from './tracks'

export interface GeneratedBrief {
  targetSkillId: string
  targetSkillName: string
  title: string
  briefText: string
  difficulty: number
}

export interface BriefOptions {
  targetRole: string | null
  skillLevel: SkillLevel | null
  careerTrack: CareerTrack | null
}

const SYSTEM = `You write a short, concrete project brief for a computer science student who wants to demonstrate a specific skill.

Workmark verifies skills by scanning the code a student actually writes, in repositories they link. So the brief's job is to produce a real repository worth scanning, not a tutorial exercise.

A good brief:
- Can be built in the stated time by one person.
- Names a specific working thing that runs and does something, not "learn React".
- Genuinely exercises the target skill in a way a scan could see.
- Says exactly what "done" means.
- Is not a clone of a well-known tutorial, and has at least one non-obvious design decision.

The student states their level. Calibrate the project to it: the same skill should produce a visibly different project for a beginner than for someone working at research level.

Write in markdown, in exactly this layout and nothing else: no preamble, no closing remarks.

# <Project name, under 8 words>

**Time:** <one of: A weekend | A few days | A week or two | Several weeks | A month or more>

## What you'll build
<2 or 3 short sentences: what it is and who would use it.>

## Why it proves <skill>
<1 or 2 sentences.>

## Done when
- <3 to 5 short, checkable bullets>

## Stretch
- <1 or 2 optional extras>

Second person, plain words, short sentences. Keep the whole brief under 220 words.`

/** What the model is told about this student and this skill. */
async function buildContext(
  supabase: SupabaseClient,
  studentId: string,
  targetSkillId: string,
  options: BriefOptions,
) {
  const { targetRole, skillLevel, careerTrack } = options
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
    .select('skill_id, difficulty_cleared')
    .eq('student_id', studentId)
  const levelBySkill = new Map<string, number>()
  for (const e of evidence ?? []) {
    levelBySkill.set(e.skill_id, Math.max(levelBySkill.get(e.skill_id) ?? 0, e.difficulty_cleared ?? 0))
  }
  const existingIds = Array.from(levelBySkill.keys())
  const { data: existingSkills } = existingIds.length
    ? await supabase.from('skills').select('id, canonical_name').in('id', existingIds)
    : { data: [] as { id: string; canonical_name: string }[] }
  // With the level each one is at, so the model can see how far along they
  // are rather than only what they have touched.
  const existingNames = (existingSkills ?? []).map((s) =>
    `${s.canonical_name} (${LEVEL_NAMES[levelBySkill.get(s.id) ?? 1] ?? 'Beginner'})`)

  const userContent = [
    `Target skill: ${skill.canonical_name}`,
    skillLevel ? `Level: ${SKILL_LEVEL_META[skillLevel].label}. ${SKILL_LEVEL_META[skillLevel].prompt}` : null,
    careerTrack ? CAREER_TRACK_META[careerTrack].prompt : null,
    // Typed by the student, so it is data rather than instruction.
    targetRole ? `Additional context on what they're aiming for:\n${untrusted('target_role', targetRole)}` : null,
    existingNames.length
      ? `They already have verified evidence in: ${existingNames.join(', ')}. Build on these where it makes the project better, but the target skill is what this brief must demonstrate.`
      : 'They have no verified evidence yet. This would be their first project on the platform, so keep the scope achievable.',
  ].filter(Boolean).join('\n')

  return {
    skill,
    userContent,
    inputForAudit: {
      target_skill_id: targetSkillId,
      target_role: targetRole,
      skill_level: skillLevel,
      career_track: careerTrack,
      existing_skills: existingNames,
    },
  }
}

/**
 * Write a brief, streaming it as it is written. onText receives each piece
 * of markdown; the parsed brief is returned once it is complete. Background
 * callers (the nightly recommendations) simply pass no onText.
 */
export async function generateBrief(
  supabase: SupabaseClient,
  studentId: string,
  targetSkillId: string,
  options: BriefOptions,
  onText?: (delta: string) => void,
): Promise<GeneratedBrief | null> {
  const ctx = await buildContext(supabase, studentId, targetSkillId, options)
  const result = await streamTextAgent(supabase, {
    agentType: 'brief',
    studentId,
    system: SYSTEM,
    userContent: ctx.userContent,
    inputForAudit: ctx.inputForAudit,
    onText,
    maxTokens: 1500,
  })
  if (!result) return null

  const parsed = parseBriefMarkdown(result.text)
  return {
    targetSkillId: ctx.skill.id,
    targetSkillName: ctx.skill.canonical_name,
    title: parsed.title,
    briefText: parsed.body,
    difficulty: parsed.difficulty,
  }
}
