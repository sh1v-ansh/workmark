// Career tracks and skill levels for project briefs.
//
// Shared between the picker UI, the API route's validation, and the prompt
// so all three cannot drift. The `prompt` strings are what the agent
// actually reads — they exist because "advanced" on its own means nothing
// to a model, while "you have shipped things in this area; assume tooling
// and idiom are not the hard part" produces a visibly different brief.

export const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'research'] as const
export type SkillLevel = (typeof SKILL_LEVELS)[number]

export const CAREER_TRACKS = [
  'frontend', 'backend', 'systems', 'ml_ai', 'data', 'security', 'mobile', 'infrastructure',
] as const
export type CareerTrack = (typeof CAREER_TRACKS)[number]

export const SKILL_LEVEL_META: Record<SkillLevel, { label: string; hint: string; prompt: string }> = {
  beginner: {
    label: 'Beginner',
    hint: 'New to this — first real project in it',
    prompt: 'The student is new to this skill. Assume no familiarity with its ecosystem or idioms. The project must be finishable by someone learning as they go, and every non-obvious step should be named explicitly rather than assumed. Avoid requiring more than one unfamiliar tool at once.',
  },
  intermediate: {
    label: 'Intermediate',
    hint: 'Used it before — want something substantial',
    prompt: 'The student has used this skill before on small things. Assume basic fluency. The project should require them to make real design decisions rather than follow a known path, but should not depend on deep internals knowledge.',
  },
  advanced: {
    label: 'Advanced',
    hint: 'Confident — want depth, not breadth',
    prompt: 'The student is confident with this skill. Tooling and idiom are not the hard part. The project must have genuine difficulty in it — a real performance, correctness, or architecture problem that cannot be solved by reaching for an obvious library.',
  },
  research: {
    label: 'Research',
    hint: 'Publication or novel-contribution level',
    prompt: 'The student is working at research level. The project should engage with an open or unsettled problem, require reading primary sources or papers, and produce something with a defensible novel element — a reproduction with new analysis, a measured comparison nobody has published, or an implementation of a recent paper. State what would make the result worth writing up.',
  },
}

export const CAREER_TRACK_META: Record<CareerTrack, { label: string; prompt: string }> = {
  frontend: {
    label: 'Frontend',
    prompt: 'Aiming at frontend roles — interface work, client-side state, rendering, accessibility, browser behaviour.',
  },
  backend: {
    label: 'Backend',
    prompt: 'Aiming at backend roles — APIs, data modelling, business logic, services, correctness under concurrent access.',
  },
  systems: {
    label: 'Systems',
    prompt: 'Aiming at systems roles — memory, concurrency, operating systems, compilers, networking protocols, performance at the machine level.',
  },
  ml_ai: {
    label: 'ML / AI',
    prompt: 'Aiming at machine learning roles — models, training, evaluation, data pipelines, inference. Evaluation methodology matters as much as the model.',
  },
  data: {
    label: 'Data',
    prompt: 'Aiming at data roles — pipelines, warehousing, analysis, transformation at scale, correctness and reproducibility of results.',
  },
  security: {
    label: 'Security',
    prompt: 'Aiming at security roles — threat modelling, cryptography, exploitation and defence, auditing. Keep the project strictly to systems the student owns or to deliberately vulnerable practice targets.',
  },
  mobile: {
    label: 'Mobile',
    prompt: 'Aiming at mobile roles — native or cross-platform apps, device constraints, offline behaviour, platform APIs.',
  },
  infrastructure: {
    label: 'Infrastructure',
    prompt: 'Aiming at infrastructure and platform roles — deployment, orchestration, observability, CI/CD, reliability, infrastructure as code.',
  },
}

export function isSkillLevel(v: unknown): v is SkillLevel {
  return typeof v === 'string' && (SKILL_LEVELS as readonly string[]).includes(v)
}

export function isCareerTrack(v: unknown): v is CareerTrack {
  return typeof v === 'string' && (CAREER_TRACKS as readonly string[]).includes(v)
}
