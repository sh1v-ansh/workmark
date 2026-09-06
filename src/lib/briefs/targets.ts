/**
 * Which skills a student should be offered a project in.
 *
 * No model is involved in this decision, and that is deliberate. Asking an
 * agent "what should this person build next" spends money to produce an
 * opinion nobody can check, when the answer is sitting in two tables: what
 * their record proves, and what open listings ask for. The agent's job is to
 * write a good brief for a skill; choosing the skill is arithmetic.
 *
 * Three reasons, at most one of each, because three recommendations that all
 * say the same thing is one recommendation printed three times:
 *
 *   adjacent — a sibling in the taxonomy of something they are strong in,
 *              which they have never touched.
 *   deepen   — a skill they are already strong in, with the thinnest
 *              evidence behind it. Strength resting on one project is the
 *              most fragile thing on a record.
 *   gap      — an open listing wants it and they have no evidence at all.
 *
 * They are claimed in that order, which is not the order of importance —
 * gap is the strongest of the three, because it is the only one backed by
 * somebody else's stated need rather than our guess about a trajectory. It
 * is claimed last because it is the least specific, and claiming it first
 * eats the other two.
 *
 * A skill that is both in demand and next door to a strength is the best
 * recommendation available, and it will nearly always be both. Letting the
 * gap rule take it first meant "adjacent" essentially never fired, and the
 * student was told "open projects want Redis" when we could have told them
 * "Redis is the next thing along from what you are already good at" — the
 * same project, explained in terms of them rather than the market.
 */

export type RecommendationReason = 'gap' | 'deepen' | 'adjacent'

export interface SkillEvidenceSummary {
  skillId: string
  /** Their best level in it, 1-5. */
  level: number
  /** How many distinct projects back it. */
  projectCount: number
}

export interface TargetInput {
  evidence: SkillEvidenceSummary[]
  /** skillId -> how many open listings ask for it. */
  demand: Map<string, number>
  /** skillId -> its parent in the taxonomy, for finding neighbours. */
  parentBySkill: Map<string, string | null>
  /** parentId -> every skill under it. */
  childrenByParent: Map<string, string[]>
  /** Skills to leave alone — they already have an open recommendation. */
  exclude?: Set<string>
}

export interface Target {
  skillId: string
  reason: RecommendationReason
}

/** At or above this, a skill counts as one of their strengths. */
const STRONG_LEVEL = 3

export function pickRecommendationTargets(input: TargetInput, limit = 3): Target[] {
  const { evidence, demand, parentBySkill, childrenByParent } = input
  const exclude = input.exclude ?? new Set<string>()

  const have = new Set(evidence.map((e) => e.skillId))
  const picked: Target[] = []
  const taken = new Set<string>()

  const claim = (skillId: string, reason: RecommendationReason): boolean => {
    if (taken.has(skillId) || exclude.has(skillId)) return false
    taken.add(skillId)
    picked.push({ skillId, reason })
    return true
  }

  // Strongest first, then the thinnest evidence within that. A level 3 with
  // one project behind it is a claim resting on a single repository; the
  // same level with five is not the thing to spend a recommendation on.
  const strengths = evidence
    .filter((e) => e.level >= STRONG_LEVEL && !exclude.has(e.skillId))
    .sort((a, b) => b.level - a.level || a.projectCount - b.projectCount || a.skillId.localeCompare(b.skillId))

  // The highest-demand skills they cannot show any evidence for. Ties break
  // on skill id so the same student gets the same answer twice running —
  // a recommendation that reshuffles nightly reads as noise.
  const gaps = Array.from(demand.entries())
    .filter(([skillId]) => !have.has(skillId) && !exclude.has(skillId))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))

  // ── adjacent ───────────────────────────────────────────────────────────
  // First, because it is the most specific thing we can say. Ordered by
  // their strength in the skill it neighbours, then by demand.
  const neighbours: { skillId: string; strength: number; want: number }[] = []
  const seen = new Set<string>()
  for (const strong of strengths) {
    const parent = parentBySkill.get(strong.skillId)
    if (!parent) continue
    for (const sibling of childrenByParent.get(parent) ?? []) {
      if (sibling === strong.skillId || have.has(sibling) || seen.has(sibling)) continue
      seen.add(sibling)
      neighbours.push({ skillId: sibling, strength: strong.level, want: demand.get(sibling) ?? 0 })
    }
  }
  neighbours.sort((a, b) => b.strength - a.strength || b.want - a.want || a.skillId.localeCompare(b.skillId))
  if (neighbours.length > 0) claim(neighbours[0].skillId, 'adjacent')

  // ── deepen ─────────────────────────────────────────────────────────────
  if (strengths.length > 0) claim(strengths[0].skillId, 'deepen')

  // ── gap ────────────────────────────────────────────────────────────────
  // Last to claim, and it fills every remaining slot. A student with no
  // strengths yet gets three gaps rather than one recommendation and an
  // apology about not knowing them well enough.
  for (const [skillId] of gaps) {
    if (picked.length >= limit) break
    claim(skillId, 'gap')
  }

  return picked.slice(0, limit)
}

/** What the card says about why this is here. Written for the student. */
export const REASON_COPY: Record<RecommendationReason, { label: string; explain: (skill: string) => string }> = {
  gap: {
    label: 'Fills a gap',
    explain: (skill) => `Open projects are asking for ${skill} and your record does not have it yet.`,
  },
  deepen: {
    label: 'Goes deeper',
    explain: (skill) => `You are already strong in ${skill}. This is the kind of project that makes that hard to argue with.`,
  },
  adjacent: {
    label: 'Next step',
    explain: (skill) => `${skill} sits next to what you already do well, and you have not built with it yet.`,
  },
}
