export type PosterType = 'company' | 'faculty'

export type Student = {
  id: string
  full_name: string | null
  university: string | null
  major: string | null
  degree_type: string | null
  graduation_year: number | null
  gpa: number | null
  is_international: boolean
  visa_type: string | null
  skills: string[] | null
  github_url: string | null
  github_username: string | null
  linkedin_url: string | null
  resume_url: string | null
  availability: string | null
  hours_per_week: number | null
  available_from: string | null
  created_at: string
}

export type Company = {
  id: string
  company_name: string | null
  website: string | null
  industry: string | null
  company_size: string | null
  hq_location: string | null
  contact_name: string | null
  contact_email: string | null
  created_at: string
}

export type Faculty = {
  id: string
  full_name: string | null
  institution: string | null
  department: string | null
  title: string | null
  email: string | null
  is_approved: boolean
  created_at: string
}

export type Project = {
  id: string
  poster_id: string
  poster_type: PosterType
  poster_display_name: string | null
  title: string | null
  description: string | null
  type: string | null
  required_skills: string[] | null
  preferred_skills: string[] | null
  work_mode: string | null
  location: string | null
  duration: string | null
  hours_per_week: number | null
  is_paid: boolean
  compensation: string | null
  work_auth_required: boolean
  min_gpa: number | null
  degree_level: string | null
  preferred_majors: string[] | null
  scoped_to_institution: string | null
  is_open: boolean
  created_at: string
}

export type Application = {
  id: string
  project_id: string
  student_id: string
  resume_url: string | null
  proposal_text: string | null
  status: string
  created_at: string
  projects?: Pick<Project, 'title' | 'poster_id' | 'poster_type'> & {
    poster_display_name?: string | null
  }
  students?: Pick<Student, 'full_name' | 'university' | 'gpa' | 'skills' | 'resume_url'>
}

export type VerifiedWorkRecord = {
  id: string
  application_id: string
  student_id: string
  poster_id: string
  poster_type: PosterType
  project_id: string
  project_title: string | null
  poster_display_name: string | null
  skills_used: string[] | null
  start_date: string | null
  end_date: string | null
  hours_logged: number | null
  outcome: string | null

  summary_draft: string | null
  summary_final: string | null
  technologies_used: string[] | null
  deliverables_status: 'yes' | 'partial' | 'no' | null
  would_engage_again: boolean | null
  independence_level: 'independent' | 'some_guidance' | 'frequent_checkins' | null
  communication_level: 'proactive' | 'responsive' | 'needed_followup' | null
  problem_solving_level: 'proposed_solutions' | 'described_problems' | 'got_stuck' | null

  tier: 1 | 2 | null
  student_approved_at: string | null
  poster_approved_at: string | null
  locked_at: string | null

  artifact_urls: string[] | null
  complexity_score: number | null

  verification_status: 'in_progress' | 'verified' | 'incomplete'
  verification_token: string
  verified_at: string | null
  created_at: string
}

/** Legacy alias — retained temporarily so v1 UI code that imports
 *  `ExperienceRecord` still typechecks while we migrate consumers. */
export type ExperienceRecord = VerifiedWorkRecord

export type Milestone = {
  id: string
  record_id: string
  title: string | null
  due_date: string | null
  status: 'upcoming' | 'on_track' | 'issue_flagged' | 'completed'
  notes: string | null
  created_at: string
}

export type IssueFlag = {
  id: string
  record_id: string
  flagged_by_role: 'student' | 'poster'
  description: string | null
  resolved_at: string | null
  created_at: string
}

export type GithubEvidencedSkill = {
  id: string
  student_id: string
  skill: string
  evidence_count: number
  repo_urls: string[] | null
  extracted_at: string
}

export type GithubRepoProfile = {
  id: string
  student_id: string
  repo_full_name: string
  repo_url: string | null
  project_type: 'web-app' | 'api' | 'ml' | 'cli' | 'library' | 'mobile' | 'unknown' | null
  architecture: 'monolith' | 'microservices' | 'serverless' | 'static' | 'unknown' | null
  has_tests: boolean
  has_ci: boolean
  has_docker: boolean
  has_docs: boolean
  has_auth: boolean
  has_deploy_config: boolean
  extracted_at: string
}

export type UserRole = 'student' | 'company' | 'faculty' | null
