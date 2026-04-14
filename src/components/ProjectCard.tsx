import Link from 'next/link'
import type { Project } from '@/lib/types'

interface ProjectCardProps {
  project: Project
}

const typeColors: Record<string, string> = {
  internship: 'bg-blue-50 text-blue-700',
  project: 'bg-purple-50 text-purple-700',
  'part-time': 'bg-orange-50 text-orange-700',
}

const workModeColors: Record<string, string> = {
  remote: 'bg-green-50 text-green-700',
  onsite: 'bg-yellow-50 text-yellow-700',
  hybrid: 'bg-teal-50 text-teal-700',
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const required = project.required_skills ?? []
  const displaySkills = required.slice(0, 4)
  const extra = required.length - displaySkills.length

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group block rounded-2xl border border-gray-200 bg-white p-5 hover:border-brand-300 hover:shadow-md transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold text-gray-900 group-hover:text-brand-700 transition-colors leading-snug">
            {project.title ?? 'Untitled Project'}
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {project.companies?.company_name ?? 'Company'} ·{' '}
            {project.companies?.hq_location ?? 'Location unknown'}
          </p>
        </div>

        {/* Paid badge */}
        {project.is_paid ? (
          <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
            Paid
          </span>
        ) : (
          <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
            Unpaid
          </span>
        )}
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {project.type && (
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
              typeColors[project.type] ?? 'bg-gray-100 text-gray-600'
            }`}
          >
            {project.type}
          </span>
        )}
        {project.work_mode && (
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
              workModeColors[project.work_mode] ?? 'bg-gray-100 text-gray-600'
            }`}
          >
            {project.work_mode}
          </span>
        )}
        {project.work_auth_required && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600">
            US Auth Required
          </span>
        )}
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-3">
        {project.duration && (
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {project.duration}
          </span>
        )}
        {project.hours_per_week && (
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {project.hours_per_week}h/week
          </span>
        )}
        {project.compensation && (
          <span className="flex items-center gap-1 font-medium text-gray-700">
            {project.compensation}
          </span>
        )}
      </div>

      {/* Skills */}
      {displaySkills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {displaySkills.map((skill) => (
            <span
              key={skill}
              className="text-xs px-2 py-0.5 rounded-md bg-gray-100 text-gray-600"
            >
              {skill}
            </span>
          ))}
          {extra > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-md bg-gray-100 text-gray-400">
              +{extra} more
            </span>
          )}
        </div>
      )}
    </Link>
  )
}
