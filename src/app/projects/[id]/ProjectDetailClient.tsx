'use client'

import { useState } from 'react'
import Link from 'next/link'
import ApplyModal from '@/components/ApplyModal'
import type { Project, Student } from '@/lib/types'

interface Props {
  project: Project & {
    companies?: {
      company_name: string | null
      industry: string | null
      hq_location: string | null
      website: string | null
    }
  }
  student: Student | null
  alreadyApplied: boolean
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${className ?? 'bg-gray-100 text-gray-600'}`}
    >
      {children}
    </span>
  )
}

export default function ProjectDetailClient({ project, student, alreadyApplied }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [applied, setApplied] = useState(alreadyApplied)

  const company = project.companies

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <header className="border-b border-gray-100 bg-white sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg tracking-tight text-gray-900">
            Work<span className="text-brand-600">mark</span>
          </Link>
          <Link
            href="/projects"
            className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            ← All projects
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Main content ── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title block */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex flex-wrap gap-2 mb-3">
                {project.type && (
                  <Badge className="bg-blue-50 text-blue-700 capitalize">{project.type}</Badge>
                )}
                {project.work_mode && (
                  <Badge className="bg-green-50 text-green-700 capitalize">
                    {project.work_mode}
                  </Badge>
                )}
                {project.is_paid ? (
                  <Badge className="bg-emerald-50 text-emerald-700">Paid</Badge>
                ) : (
                  <Badge className="bg-gray-100 text-gray-500">Unpaid</Badge>
                )}
                {project.work_auth_required && (
                  <Badge className="bg-red-50 text-red-600">US Auth Required</Badge>
                )}
              </div>

              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                {project.title ?? 'Untitled Project'}
              </h1>
              <p className="text-gray-500">
                {company?.company_name}{company?.hq_location ? ` · ${company.hq_location}` : ''}
              </p>
            </div>

            {/* Description */}
            {project.description && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
                  About this project
                </h2>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {project.description}
                </p>
              </div>
            )}

            {/* Skills */}
            {((project.required_skills?.length ?? 0) > 0 ||
              (project.preferred_skills?.length ?? 0) > 0) && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
                  Skills
                </h2>
                {(project.required_skills?.length ?? 0) > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-500 mb-2">Required</p>
                    <div className="flex flex-wrap gap-1.5">
                      {project.required_skills!.map((s) => (
                        <span
                          key={s}
                          className="text-xs px-2.5 py-1 rounded-lg bg-brand-50 text-brand-700 font-medium"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {(project.preferred_skills?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Nice to have</p>
                    <div className="flex flex-wrap gap-1.5">
                      {project.preferred_skills!.map((s) => (
                        <span
                          key={s}
                          className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Sidebar ── */}
          <div className="space-y-4">
            {/* Apply card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              {applied ? (
                <div className="text-center py-2">
                  <div className="text-green-600 text-2xl mb-1">✓</div>
                  <p className="text-sm font-semibold text-green-700">Application submitted</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Track it in your dashboard
                  </p>
                  <Link
                    href="/student/dashboard"
                    className="mt-3 block text-center text-xs text-brand-600 hover:underline"
                  >
                    View dashboard →
                  </Link>
                </div>
              ) : student ? (
                <button
                  onClick={() => setShowModal(true)}
                  className="w-full py-3 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700 transition-colors"
                >
                  Apply now
                </button>
              ) : (
                <div className="text-center space-y-2">
                  <Link
                    href="/login"
                    className="block w-full py-3 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700 transition-colors text-center"
                  >
                    Sign in to apply
                  </Link>
                  <p className="text-xs text-gray-400">
                    New?{' '}
                    <Link href="/login" className="text-brand-600 hover:underline">
                      Create an account
                    </Link>
                  </p>
                </div>
              )}
            </div>

            {/* Details card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                Details
              </h3>

              <Detail label="Duration" value={project.duration} />
              <Detail
                label="Hours / week"
                value={project.hours_per_week ? `${project.hours_per_week}h` : undefined}
              />
              <Detail label="Compensation" value={project.compensation} />
              <Detail label="Location" value={project.location} />
              <Detail
                label="Degree"
                value={project.degree_level
                  ? project.degree_level === 'both'
                    ? 'Undergrad & Grad'
                    : project.degree_level === 'undergrad'
                    ? 'Undergrad'
                    : 'Graduate'
                  : undefined}
              />
              <Detail
                label="Min. GPA"
                value={project.min_gpa ? `${project.min_gpa}` : undefined}
              />
              {project.preferred_majors && project.preferred_majors.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Preferred majors</p>
                  <div className="flex flex-wrap gap-1">
                    {project.preferred_majors.map((m) => (
                      <span key={m} className="text-xs px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Company card */}
            {company && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-1">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                  {company.company_name ?? 'Company'}
                </h3>
                {company.industry && (
                  <p className="text-xs text-gray-500">{company.industry}</p>
                )}
                {company.hq_location && (
                  <p className="text-xs text-gray-500">{company.hq_location}</p>
                )}
                {company.website && (
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-brand-600 hover:underline block mt-1"
                  >
                    Visit website ↗
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {showModal && student && (
        <ApplyModal
          projectId={project.id}
          projectTitle={project.title ?? 'Project'}
          student={student}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false)
            setApplied(true)
          }}
        />
      )}
    </div>
  )
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm text-gray-800 font-medium">{value}</p>
    </div>
  )
}
