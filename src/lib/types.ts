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

export type Project = {
  id: string
  company_id: string
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
  is_open: boolean
  created_at: string
  companies?: Pick<Company, 'company_name' | 'industry' | 'hq_location'>
}

export type Application = {
  id: string
  project_id: string
  student_id: string
  resume_url: string | null
  status: string
  created_at: string
  projects?: Pick<Project, 'title' | 'company_id'> & {
    companies?: Pick<Company, 'company_name'>
  }
  students?: Pick<Student, 'full_name' | 'university' | 'gpa' | 'skills' | 'resume_url'>
}

export type ExperienceRecord = {
  id: string
  application_id: string
  student_id: string
  company_id: string
  project_id: string
  project_title: string | null
  company_name: string | null
  skills_used: string[] | null
  start_date: string | null
  end_date: string | null
  verification_status: string
  verification_token: string
  verified_at: string | null
  created_at: string
}

export type Faculty = {
  id: string
  full_name: string | null
  institution: string | null
  department: string | null
  title: string | null
  email: string | null
  created_at: string
}

export type UserRole = 'student' | 'company' | 'faculty' | null
