'use client'

import { useState } from 'react'
import Link from 'next/link'
import ApplyModal from '@/components/ApplyModal'
import Navbar from '@/components/Navbar'
import { C, F } from '@/app/landing/tokens'
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

export default function ProjectDetailClient({ project, student, alreadyApplied }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [applied, setApplied] = useState(alreadyApplied)

  const company = project.companies

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {student ? (
        <Navbar role="student" />
      ) : (
        <header style={{ borderBottom: `1px solid ${C.border}`, background: 'rgba(13,13,11,0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', position: 'sticky', top: 0, zIndex: 40 }}>
          <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: F.serif, fontSize: 18, fontWeight: 700, color: C.text }}>W</span>
              <span style={{ fontFamily: F.mono, fontSize: 13, color: C.textMuted, letterSpacing: '0.05em' }}>workmark</span>
            </Link>
            <Link href="/projects" style={{ fontFamily: F.mono, fontSize: 12, color: C.textMuted, textDecoration: 'none', letterSpacing: '0.04em' }}>
              ← All projects
            </Link>
          </div>
        </header>
      )}

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
        {student && (
          <Link href="/projects" style={{ fontFamily: F.mono, fontSize: 12, color: C.textMuted, textDecoration: 'none', display: 'inline-block', marginBottom: 24 }}>
            ← All projects
          </Link>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 20, alignItems: 'flex-start' }}>
          {/* Main content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Title block */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 28 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {project.type && <Chip>{project.type.charAt(0).toUpperCase() + project.type.slice(1)}</Chip>}
                {project.work_mode && <Chip>{project.work_mode.charAt(0).toUpperCase() + project.work_mode.slice(1)}</Chip>}
                {project.is_paid ? (
                  <Chip accent>Paid</Chip>
                ) : (
                  <Chip>Unpaid</Chip>
                )}
                {project.work_auth_required && <Chip red>US Auth Required</Chip>}
              </div>

              <h1 style={{ fontFamily: F.serif, fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 6, lineHeight: 1.3 }}>
                {project.title ?? 'Untitled Project'}
              </h1>
              <p style={{ fontFamily: F.mono, fontSize: 12, color: C.textFaint }}>
                {company?.company_name}{company?.hq_location ? ` · ${company.hq_location}` : ''}
              </p>
            </div>

            {/* Description */}
            {project.description && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 28 }}>
                <h2 style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>
                  About this project
                </h2>
                <p style={{ fontSize: 13, color: C.textSub, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {project.description}
                </p>
              </div>
            )}

            {/* Skills */}
            {((project.required_skills?.length ?? 0) > 0 || (project.preferred_skills?.length ?? 0) > 0) && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 28 }}>
                <h2 style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
                  Skills
                </h2>
                {(project.required_skills?.length ?? 0) > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint, marginBottom: 8 }}>Required</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {project.required_skills!.map((s) => (
                        <span key={s} style={{ fontSize: 11, padding: '3px 9px', background: C.accentHover, border: `1px solid ${C.accentBorder}`, color: C.accent, fontFamily: F.mono }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {(project.preferred_skills?.length ?? 0) > 0 && (
                  <div>
                    <p style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint, marginBottom: 8 }}>Nice to have</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {project.preferred_skills!.map((s) => (
                        <span key={s} style={{ fontSize: 11, padding: '3px 9px', background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.textMuted, fontFamily: F.mono }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Apply card */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 20 }}>
              {applied ? (
                <div style={{ textAlign: 'center', padding: '8px 0' }}>
                  <p style={{ fontFamily: F.mono, fontSize: 12, color: C.accent, marginBottom: 6, letterSpacing: '0.04em' }}>✓ Application submitted</p>
                  <p style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, marginBottom: 12 }}>Track it in your dashboard</p>
                  <Link href="/student/dashboard" style={{ fontFamily: F.mono, fontSize: 11, color: C.accent, textDecoration: 'none' }}>
                    View dashboard →
                  </Link>
                </div>
              ) : student ? (
                <button
                  onClick={() => setShowModal(true)}
                  style={{ width: '100%', padding: '12px 0', background: C.accent, border: 'none', color: C.bg, fontFamily: F.mono, fontSize: 12, fontWeight: 500, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em', transition: 'opacity 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                >
                  Apply now
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'center' }}>
                  <Link href="/login" style={{ display: 'block', padding: '12px 0', background: C.accent, color: C.bg, fontFamily: F.mono, fontSize: 12, fontWeight: 500, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Sign in to apply
                  </Link>
                  <p style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint }}>
                    New?{' '}
                    <Link href="/login" style={{ color: C.accent, textDecoration: 'none' }}>Create an account</Link>
                  </p>
                </div>
              )}
            </div>

            {/* Details card */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 20 }}>
              <h3 style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>
                Details
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Detail label="Duration" value={project.duration} />
                <Detail label="Hours / week" value={project.hours_per_week ? `${project.hours_per_week}h` : undefined} />
                <Detail label="Compensation" value={project.compensation} />
                <Detail label="Location" value={project.location} />
                <Detail label="Degree" value={
                  project.degree_level
                    ? project.degree_level === 'both' ? 'Undergrad & Grad'
                    : project.degree_level === 'undergrad' ? 'Undergrad'
                    : 'Graduate'
                    : undefined
                } />
                <Detail label="Min. GPA" value={project.min_gpa ? `${project.min_gpa}` : undefined} />
                {project.preferred_majors && project.preferred_majors.length > 0 && (
                  <div>
                    <p style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint, marginBottom: 6 }}>Preferred majors</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {project.preferred_majors.map((m) => (
                        <span key={m} style={{ fontSize: 10, padding: '2px 7px', background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.textMuted, fontFamily: F.mono }}>
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Company card */}
            {company && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 20 }}>
                <h3 style={{ fontFamily: F.mono, fontSize: 13, fontWeight: 500, color: C.textSub, marginBottom: 8 }}>
                  {company.company_name ?? 'Company'}
                </h3>
                {company.industry && (
                  <p style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, marginBottom: 4 }}>{company.industry}</p>
                )}
                {company.hq_location && (
                  <p style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, marginBottom: 4 }}>{company.hq_location}</p>
                )}
                {company.website && (
                  <a href={company.website} target="_blank" rel="noopener noreferrer" style={{ fontFamily: F.mono, fontSize: 11, color: C.accent, textDecoration: 'none' }}>
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

function Chip({ children, accent, red }: { children: React.ReactNode; accent?: boolean; red?: boolean }) {
  const color = red ? '#f87171' : accent ? C.accent : C.textMuted
  const bg = red ? 'rgba(248,113,113,0.08)' : accent ? C.accentHover : C.surfaceAlt
  const border = red ? 'rgba(248,113,113,0.25)' : accent ? C.accentBorder : C.border
  return (
    <span style={{ fontSize: 9, fontFamily: F.mono, padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.08em', color, background: bg, border: `1px solid ${border}` }}>
      {children}
    </span>
  )
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div>
      <p style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint, marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 13, color: C.textSub, fontWeight: 500 }}>{value}</p>
    </div>
  )
}
