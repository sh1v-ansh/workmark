'use client'

import Link from 'next/link'
import Navbar from '@/components/Navbar'
import type { Student, Application, ExperienceRecord } from '@/lib/types'

// ─── Status badge helpers ─────────────────────────────────────────────────────

function AppStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    applied: 'bg-blue-50 text-blue-700',
    accepted: 'bg-green-50 text-green-700',
    rejected: 'bg-red-50 text-red-600',
  }
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
        map[status] ?? 'bg-gray-100 text-gray-600'
      }`}
    >
      {status}
    </span>
  )
}

function ExperienceBadge({ status }: { status: string }) {
  if (status === 'verified') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
        Workmark Verified
      </span>
    )
  }
  if (status === 'in_progress') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
        In Progress
      </span>
    )
  }
  return (
    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
      Incomplete
    </span>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  student: Student
  applications: (Application & {
    projects?: { title: string | null; companies?: { company_name: string | null } }
  })[]
  experienceRecords: ExperienceRecord[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StudentDashboardClient({
  student,
  applications,
  experienceRecords,
}: Props) {
  const verifiedCount = experienceRecords.filter(
    (r) => r.verification_status === 'verified'
  ).length

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar role="student" userName={student.full_name ?? undefined} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* ── Profile summary ── */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {student.full_name ?? 'Your Profile'}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {[student.degree_type, student.major, student.university]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <div className="flex gap-3">
              {student.github_url && (
                <a
                  href={student.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  GitHub ↗
                </a>
              )}
              {student.linkedin_url && (
                <a
                  href={student.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  LinkedIn ↗
                </a>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <StatCard label="Applications" value={applications.length} />
            <StatCard label="Accepted" value={applications.filter((a) => a.status === 'accepted').length} />
            <StatCard label="Experience records" value={experienceRecords.length} />
            <StatCard label="Verified" value={verifiedCount} highlight />
          </div>

          {/* Skills */}
          {student.skills && student.skills.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-gray-400 mb-2">Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {student.skills.map((s) => (
                  <span
                    key={s}
                    className="text-xs px-2.5 py-0.5 rounded-lg bg-gray-100 text-gray-700"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Experience Records ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900">
              My Experience
            </h2>
            <Link
              href="/projects"
              className="text-sm text-brand-600 hover:underline"
            >
              Browse projects →
            </Link>
          </div>

          {experienceRecords.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400">
              <p className="text-base mb-1">No experience records yet</p>
              <p className="text-sm">
                Get accepted to a project to start earning verified records.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {experienceRecords.map((record) => (
                <div
                  key={record.id}
                  className="bg-white rounded-2xl border border-gray-200 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {record.project_title ?? 'Project'}
                      </p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {record.company_name}
                      </p>
                    </div>
                    <ExperienceBadge status={record.verification_status} />
                  </div>

                  <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-400">
                    {record.start_date && (
                      <span>
                        {fmtDate(record.start_date)}
                        {record.end_date ? ` → ${fmtDate(record.end_date)}` : ''}
                      </span>
                    )}
                    {record.verified_at && (
                      <span className="text-green-600">
                        Verified {fmtDate(record.verified_at)}
                      </span>
                    )}
                  </div>

                  {record.skills_used && record.skills_used.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {record.skills_used.map((s) => (
                        <span
                          key={s}
                          className="text-xs px-2 py-0.5 rounded-md bg-gray-100 text-gray-600"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Applications ── */}
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">My Applications</h2>

          {applications.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400">
              <p className="text-base mb-1">No applications yet</p>
              <Link
                href="/projects"
                className="text-sm text-brand-600 hover:underline"
              >
                Browse open projects →
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
              {applications.map((app) => (
                <div key={app.id} className="flex items-center justify-between p-4 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {app.projects?.title ?? 'Project'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {app.projects?.companies?.company_name ?? ''} ·{' '}
                      {fmtDate(app.created_at)}
                    </p>
                  </div>
                  <AppStatusBadge status={app.status} />
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string
  value: number
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-xl p-3 text-center ${
        highlight ? 'bg-brand-50 border border-brand-100' : 'bg-gray-50'
      }`}
    >
      <p
        className={`text-2xl font-bold ${
          highlight ? 'text-brand-700' : 'text-gray-900'
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
