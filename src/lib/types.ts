// Shared row shapes for the v0.5 schema (supabase/schema.sql).
//
// Only tables the app actually reads today are here. Deferred tables
// (outcomes, platform_signals, project_briefs, agent_calls) and deferred
// concepts (companies, faculty, attestation, payments) are deliberately
// absent rather than stubbed — a type for a table nothing queries is a
// thing to keep in sync for no benefit.
//
// Several pages intentionally define their own local prop types instead
// of importing these: a page's props are what that page needs rendered,
// which is usually a reshaped join rather than a row.

export type FitTier = 'strong_fit' | 'competitive' | 'reach' | 'not_yet'
export type ApplicationStatus = 'submitted' | 'shortlisted' | 'accepted' | 'rejected' | 'withdrawn'
export type ListingStatus = 'draft' | 'open' | 'filled' | 'closed'
export type EngagementStage = 'accepted' | 'in_progress' | 'submitted' | 'closed' | 'abandoned'
export type EngagementVisibility = 'full' | 'redacted' | 'hidden'
export type EvidenceTier = 'tier_0' | 'tier_0_5' | 'listing_driven'
export type VerificationMethod = 'repo_link' | 'deployment' | 'package' | 'ci' | 'human_review'

export interface Student {
  id: string
  full_name: string | null
  university: string | null
  major: string | null
  degree_type: string | null
  graduation_year: number | null
  gpa: number | null
  is_international: boolean
  visa_type: string | null
  /** Self-reported, display only — never feeds tier_weight. */
  skills: string[] | null
  github_url: string | null
  github_username: string | null
  linkedin_url: string | null
  availability: string | null
  hours_per_week: number | null
  available_from: string | null
  open_to_collab: boolean
  handle: string | null
  active_application_count: number
  edu_domain: string | null
  edu_verified_at: string | null
  created_at: string
}

export interface Skill {
  id: string
  canonical_name: string
  parent_id: string | null
  deprecated_at: string | null
  merged_into_id: string | null
}

export interface Listing {
  id: string
  poster_id: string
  poster_type: 'student'
  poster_display_name: string | null
  title: string | null
  brief: string | null
  est_hours: number | null
  hours_per_week: number | null
  duration: string | null
  work_mode: string | null
  team_size: number | null
  declared_difficulty: number | null
  requires_prior_evidence: boolean
  is_paid: boolean
  tier: 'listing_driven'
  status: ListingStatus
  view_count: number
  created_at: string
}

export interface ListingRequirement {
  listing_id: string
  skill_id: string
  /** Importance weight (1-5), NOT a difficulty threshold — see lib/matching/fit.ts. */
  required_level: number
}

export interface Application {
  id: string
  listing_id: string
  student_id: string
  consent_id: string | null
  claimed_skills: string[] | null
  response_text: string | null
  scored_response: unknown | null
  fit_tier_at_apply: FitTier | null
  rank_score_at_apply: number | null
  /** Frozen matching inputs as of submission — the FCRA dispute baseline. */
  computed_snapshot: unknown | null
  status: ApplicationStatus
  created_at: string
}

export interface ApplicationMessage {
  id: string
  application_id: string
  sender_id: string
  body: string
  created_at: string
}

export interface ContactShare {
  id: string
  application_id: string
  student_id: string
  poster_id: string
  student_email: string | null
  poster_email: string | null
  shared_at: string
}

export interface Engagement {
  id: string
  application_id: string
  listing_id: string
  poster_id: string
  student_id: string
  stage: EngagementStage
  abandoned_at: string | null
  opened_at: string
  submitted_at: string | null
  closed_at: string | null
  description: string | null
  description_agreed_by_student_at: string | null
  description_agreed_by_poster_at: string | null
  visibility: EngagementVisibility
  created_at: string
}

export interface GithubConnection {
  student_id: string
  installation_id: string
  github_login: string | null
  connected_at: string
}

export interface GithubRepoGrant {
  id: string
  student_id: string
  installation_id: string
  repo_full_name: string
  granted_at: string
  revoked_at: string | null
  is_private: boolean
  scan_enabled: boolean
}

export interface Artifact {
  id: string
  student_id: string
  engagement_id: string | null
  type: 'repo' | 'url' | 'file'
  source: string | null
  repo_full_name: string | null
  access_grant_id: string | null
  tier: EvidenceTier
  verification_method: VerificationMethod
  deployment_url: string | null
  verified_at: string | null
  created_at: string
}

/**
 * Append-only. Never UPDATE a row (a database trigger rejects it) —
 * corrections are new rows pointing at what they supersede via
 * corrects_evidence_id. Read through the current_skill_evidence view for
 * "current truth"; the base table is the full audit history.
 */
export interface SkillEvidence {
  id: string
  student_id: string
  skill_id: string
  artifact_id: string | null
  engagement_id: string | null
  base: number
  independence: number
  paid: number
  /** Generated: base × independence × paid. */
  tier_weight: number
  raw_composite: number | null
  difficulty_cleared: number
  verification_method: VerificationMethod
  source_agreement: number | null
  comparative_anchor: string | null
  corrects_evidence_id: string | null
  created_at: string
}

/** Unconditional scan hit — "we saw this". Never summed into tier_weight. */
export interface SkillPrior {
  id: string
  student_id: string
  skill_id: string
  raw_scan_score: number | null
  source: string | null
  extracted_at: string
}
