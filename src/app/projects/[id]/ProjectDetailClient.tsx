'use client'

import { useState } from 'react'
import Link from 'next/link'
import ApplyModal from '@/components/ApplyModal'
import Navbar from '@/components/Navbar'
import Card from '@/components/Card'
import { Icon, type IconName } from '@/components/Icon'
import { C, F } from '@/lib/theme/dark-tokens'
import { tagColor } from '@/lib/theme/tagColors'
import { Wordmark } from '@/app/landing/Wordmark'
import type { Project, Student } from '@/lib/types'

interface PosterMeta {
  name: string | null
  industry: string | null
  location: string | null
  website: string | null
}

interface Props {
  project: Project
  posterMeta: PosterMeta | null
  student: Student | null
  alreadyApplied: boolean
}

export default function ProjectDetailClient({ project, posterMeta, student, alreadyApplied }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [applied, setApplied] = useState(alreadyApplied)

  const poster = posterMeta ?? { name: project.poster_display_name, industry: null, location: null, website: null }
  const isPeerProject = project.poster_type === 'student'
  const ctaVerb = isPeerProject ? 'Request to collaborate' : 'Apply now'

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {student ? (
        <Navbar role="student" />
      ) : (
        <header style={{ borderBottom: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', position: 'sticky', top: 0, zIndex: 40 }}>
          <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link href="/" aria-label="Workmark home" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Wordmark height={27} />
            </Link>
            <Link href="/projects" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.textMuted, textDecoration: 'none' }}>
              <Icon name="arrow-right" size={13} style={{ transform: 'rotate(180deg)' }} /> All projects
            </Link>
          </div>
        </header>
      )}

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
        {student && (
          <Link href="/projects" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.textMuted, textDecoration: 'none', marginBottom: 24 }}>
            <Icon name="arrow-right" size={13} style={{ transform: 'rotate(180deg)' }} /> All projects
          </Link>
        )}

        <div className="mob-col" style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20, alignItems: 'flex-start' }}>
          {/* Main content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Title block */}
            <Card hoverable={false} padding={28}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {isPeerProject && <Chip icon="users" accent>Student project</Chip>}
                {project.type && <Chip>{project.type.charAt(0).toUpperCase() + project.type.slice(1)}</Chip>}
                {project.work_mode && <Chip>{project.work_mode.charAt(0).toUpperCase() + project.work_mode.slice(1)}</Chip>}
                {project.is_paid ? <Chip green>Paid</Chip> : <Chip>Unpaid</Chip>}
                {project.work_auth_required && <Chip red>US Auth Required</Chip>}
              </div>

              <h1 style={{ fontFamily: F.serif, fontSize: 28, fontWeight: 700, color: C.text, marginBottom: 8, lineHeight: 1.25, letterSpacing: '-0.01em' }}>
                {project.title ?? 'Untitled Project'}
              </h1>
              <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.textFaint }}>
                {poster.name}
                {poster.location && (
                  <>
                    <span aria-hidden="true">·</span>
                    <Icon name="map-pin" size={13} />
                    {poster.location}
                  </>
                )}
              </p>
            </Card>

            {/* Description */}
            {project.description && (
              <Card hoverable={false} padding={28}>
                <SectionLabel>About this project</SectionLabel>
                <p style={{ fontSize: 14, color: C.textSub, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {project.description}
                </p>
              </Card>
            )}

            {/* Skills */}
            {((project.required_skills?.length ?? 0) > 0 || (project.preferred_skills?.length ?? 0) > 0) && (
              <Card hoverable={false} padding={28}>
                <SectionLabel>Skills</SectionLabel>
                {(project.required_skills?.length ?? 0) > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 11, color: C.textFaint, marginBottom: 8 }}>Required</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {project.required_skills!.map((s) => {
                        const c = tagColor(s)
                        return (
                          <span key={s} style={{ fontSize: 12, fontWeight: 500, padding: '4px 11px', borderRadius: 999, background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontFamily: F.mono }}>
                            {s}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
                {(project.preferred_skills?.length ?? 0) > 0 && (
                  <div>
                    <p style={{ fontSize: 11, color: C.textFaint, marginBottom: 8 }}>Nice to have</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {project.preferred_skills!.map((s) => (
                        <span key={s} style={{ fontSize: 12, padding: '4px 11px', borderRadius: 999, background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.textMuted, fontFamily: F.mono }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Apply card */}
            <Card hoverable={false} padding={20}>
              {applied ? (
                <div style={{ textAlign: 'center', padding: '8px 0' }}>
                  <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: C.accent, marginBottom: 6 }}>
                    <Icon name="check" size={14} /> {isPeerProject ? 'Request sent' : 'Application submitted'}
                  </p>
                  <p style={{ fontSize: 12, color: C.textFaint, marginBottom: 14 }}>Track it in your dashboard</p>
                  <Link href="/student/dashboard" className="wm-btn wm-btn-secondary wm-btn-sm" style={{ display: 'flex', width: '100%' }}>
                    View dashboard <Icon name="arrow-right" size={13} />
                  </Link>
                </div>
              ) : student && student.id === project.poster_id ? (
                <p style={{ fontSize: 12, color: C.textFaint, textAlign: 'center', padding: '8px 0' }}>
                  This is your own project.
                </p>
              ) : student ? (
                <button onClick={() => setShowModal(true)} className="wm-btn wm-btn-primary" style={{ width: '100%', display: 'flex' }}>
                  {ctaVerb}
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'center' }}>
                  <Link href="/login" className="wm-btn wm-btn-primary" style={{ width: '100%', display: 'flex' }}>
                    Sign in to apply
                  </Link>
                  <p style={{ fontSize: 12, color: C.textFaint }}>
                    New?{' '}
                    <Link href="/login" style={{ color: C.accent, textDecoration: 'none', fontWeight: 500 }}>Create an account</Link>
                  </p>
                </div>
              )}
            </Card>

            {/* Details card */}
            <Card hoverable={false} padding={20}>
              <SectionLabel>Details</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Detail icon="award" label="Complexity" value={
                  project.complexity_level
                    ? project.complexity_level.charAt(0).toUpperCase() + project.complexity_level.slice(1)
                    : undefined
                } />
                <Detail icon="calendar" label="Duration" value={project.duration} />
                <Detail icon="clock" label="Hours / week" value={project.hours_per_week ? `${project.hours_per_week}h` : undefined} />
                <Detail icon="briefcase" label="Compensation" value={project.compensation} />
                <Detail icon="map-pin" label="Location" value={project.location} />
                <Detail icon="award" label="Degree" value={
                  project.degree_level
                    ? project.degree_level === 'both' ? 'Undergrad & Grad'
                    : project.degree_level === 'undergrad' ? 'Undergrad'
                    : 'Graduate'
                    : undefined
                } />
                <Detail icon="star" label="Min. GPA" value={project.min_gpa ? `${project.min_gpa}` : undefined} />
                {project.preferred_majors && project.preferred_majors.length > 0 && (
                  <div>
                    <p style={{ fontSize: 11, color: C.textFaint, marginBottom: 6 }}>Preferred majors</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {project.preferred_majors.map((m) => (
                        <span key={m} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.textMuted, fontFamily: F.mono }}>
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Poster card (company or faculty) */}
            {poster.name && (
              <Card hoverable={false} padding={20}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 8 }}>
                  {poster.name}
                </h3>
                {poster.industry && (
                  <p style={{ fontSize: 12, color: C.textFaint, marginBottom: 4 }}>{poster.industry}</p>
                )}
                {poster.location && (
                  <p style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.textFaint, marginBottom: 4 }}>
                    <Icon name="map-pin" size={12} />{poster.location}
                  </p>
                )}
                {poster.website && (
                  <a href={poster.website} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.accent, textDecoration: 'none', fontWeight: 500 }}>
                    Visit website <Icon name="external-link" size={12} />
                  </a>
                )}
              </Card>
            )}
          </div>
        </div>
      </main>

      {showModal && student && (
        <ApplyModal
          projectId={project.id}
          projectTitle={project.title ?? 'Project'}
          heading={isPeerProject ? 'Request to collaborate' : 'Apply to project'}
          submitLabel={isPeerProject ? 'Send request →' : 'Submit →'}
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>
      {children}
    </h2>
  )
}

function Chip({ children, accent, red, green, icon }: { children: React.ReactNode; accent?: boolean; red?: boolean; green?: boolean; icon?: 'users' }) {
  const color = red ? '#B91C1C' : green ? '#15803D' : accent ? C.accent : C.textMuted
  const bg = red ? '#FEF2F2' : green ? '#F0FDF4' : accent ? C.accentHover : C.surfaceAlt
  const border = red ? '#FECACA' : green ? '#BBF7D0' : accent ? C.accentBorder : C.border
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 999, color, background: bg, border: `1px solid ${border}` }}>
      {icon && <Icon name={icon} size={11} />}
      {children}
    </span>
  )
}

function Detail({ label, value, icon }: { label: string; value?: string | null; icon: IconName }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div style={{ color: C.textGhost, marginTop: 2 }}>
        <Icon name={icon} size={14} />
      </div>
      <div>
        <p style={{ fontSize: 10, color: C.textFaint, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
        <p style={{ fontSize: 13, color: C.textSub, fontWeight: 500 }}>{value}</p>
      </div>
    </div>
  )
}
