// Workmark complexity scoring — Spec §4.2.1.
//
// Six weighted factors, all derived from data already collected via the normal
// posting + attestation workflow. Deterministic, transparent, code-agnostic.
// The score is never shown to users as a number — it informs sort order only.
//
// Composite is on a 0-100 scale (weighted sum × normalization × 100).

import type { Project, VerifiedWorkRecord } from './types'

// Sub-scorer returns are on a 1..N scale per spec Table 3.

function techStackBreadth(technologies: string[] | null): number {
  const n = technologies?.length ?? 0
  if (n === 0) return 1
  if (n === 1) return 1
  if (n <= 3) return 2
  return 3
}

/**
 * Architecture inferred from project.type + description keywords.
 * Static = 1, CRUD = 2, Real-time = 3, Distributed = 4.
 */
function architectureType(project: Pick<Project, 'type' | 'description'>): number {
  const desc = (project.description ?? '').toLowerCase()
  if (/microservice|distributed|kafka|queue|kubernetes|k8s|sharding|event.driven/.test(desc)) return 4
  if (/real.?time|websocket|streaming|live|pubsub|sse/.test(desc)) return 3
  if (project.type === 'internship' || project.type === 'part-time') return 2 // treat ongoing work as CRUD-tier baseline
  if (/static|landing|marketing site/.test(desc)) return 1
  return 2
}

function integrationPoints(technologies: string[] | null): number {
  // Count known third-party API integrations from the skill list.
  const apis = new Set([
    'stripe', 'twilio', 'sendgrid', 'resend', 'openai', 'anthropic',
    'aws', 's3', 'ses', 'sqs', 'gcp', 'firebase', 'auth0', 'clerk',
    'algolia', 'meilisearch', 'shopify', 'plaid', 'segment', 'posthog',
    'sentry', 'datadog', 'slack', 'discord api', 'github api', 'zapier',
  ])
  const n = (technologies ?? []).map((t) => t.toLowerCase()).filter((t) => apis.has(t)).length
  if (n === 0) return 1
  if (n <= 2) return 2
  return 3
}

function durationScore(startDate: string | null, endDate: string | null): number {
  if (!startDate || !endDate) return 2
  const days = (Date.parse(endDate) - Date.parse(startDate)) / (1000 * 60 * 60 * 24)
  const weeks = days / 7
  if (weeks < 2) return 1
  if (weeks <= 6) return 2
  return 3
}

function supervisionScore(level: VerifiedWorkRecord['independence_level']): number {
  if (level === 'independent') return 3
  if (level === 'some_guidance') return 2
  if (level === 'frequent_checkins') return 1
  return 2 // neutral when not yet attested
}

/**
 * Scope-includes-auth/data-modeling/deploy — each feature adds 1 point,
 * capped at 3 (so it plays fair with the other 1..3 sub-scores).
 */
function scopeFeaturesScore(description: string | null, technologies: string[] | null): number {
  const text = `${description ?? ''} ${(technologies ?? []).join(' ')}`.toLowerCase()
  let n = 0
  if (/auth|oauth|jwt|session|login|signup/.test(text)) n++
  if (/database|postgres|mysql|mongo|sqlite|prisma|orm|schema/.test(text)) n++
  if (/deploy|vercel|render|fly\.io|heroku|kubernetes|docker|ci\/cd/.test(text)) n++
  return Math.min(Math.max(n, 1), 3)
}

const WEIGHTS = {
  tech: 0.20,
  arch: 0.25,
  integ: 0.15,
  dur: 0.10,
  sup: 0.20,
  scope: 0.10,
} as const

/**
 * Compute a 0..100 complexity score from a project + optional record snapshot.
 * The record fields (independence_level, technologies_used) are used when
 * available — otherwise falls back to the project's declared skills.
 */
export function computeComplexity(
  project: Pick<Project, 'type' | 'description' | 'required_skills' | 'preferred_skills'>,
  record: Pick<VerifiedWorkRecord, 'technologies_used' | 'independence_level' | 'start_date' | 'end_date'> | null,
): number {
  const techs =
    record?.technologies_used ??
    [...(project.required_skills ?? []), ...(project.preferred_skills ?? [])]

  const scores = {
    tech: techStackBreadth(techs),
    arch: architectureType(project),
    integ: integrationPoints(techs),
    dur: durationScore(record?.start_date ?? null, record?.end_date ?? null),
    sup: supervisionScore(record?.independence_level ?? null),
    scope: scopeFeaturesScore(project.description, techs),
  }

  // Normalize each sub-score to its own scale, then weight-sum.
  // arch is 1..4, others are 1..3.
  const normalized =
    (scores.tech / 3) * WEIGHTS.tech +
    (scores.arch / 4) * WEIGHTS.arch +
    (scores.integ / 3) * WEIGHTS.integ +
    (scores.dur / 3) * WEIGHTS.dur +
    (scores.sup / 3) * WEIGHTS.sup +
    (scores.scope / 3) * WEIGHTS.scope

  return Math.round(normalized * 100)
}

/**
 * Human-readable complexity tier for the recruiter view. Not shown as a number
 * per spec §4.3 — expressed as low/medium/high/very-high buckets so hiring
 * managers get the signal without the raw score.
 */
export function complexityBand(score: number | null): 'low' | 'medium' | 'high' | 'very-high' | null {
  if (score == null) return null
  if (score < 40) return 'low'
  if (score < 60) return 'medium'
  if (score < 80) return 'high'
  return 'very-high'
}
