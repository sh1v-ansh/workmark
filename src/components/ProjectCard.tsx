import Link from 'next/link'
import type { Project } from '@/lib/types'
import { C, F } from '@/lib/theme/dark-tokens'

interface ProjectCardProps {
  project: Project
}

const typeLabel: Record<string, string> = {
  internship: 'Internship',
  project: 'Project',
  'part-time': 'Part-time',
}

const complexityLabel: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

function posterFallbackLabel(posterType: string): string {
  if (posterType === 'faculty') return 'Faculty'
  if (posterType === 'student') return 'Student'
  return 'Company'
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const required = project.required_skills ?? []
  const displaySkills = required.slice(0, 4)
  const extra = required.length - displaySkills.length

  return (
    <Link
      href={`/projects/${project.id}`}
      style={{
        display: 'block', background: C.surface, border: `1px solid ${C.border}`,
        padding: 20, textDecoration: 'none', transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.accent)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 14, fontWeight: 500, color: C.textSub, marginBottom: 3, lineHeight: 1.4 }}>
            {project.title ?? 'Untitled Project'}
          </h3>
          <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>
            {project.poster_display_name ?? posterFallbackLabel(project.poster_type)}{project.location ? ` · ${project.location}` : project.work_mode === 'remote' ? ' · Remote' : ''}
          </p>
        </div>
        <span style={{
          flexShrink: 0, fontSize: 9, fontFamily: F.mono, padding: '2px 7px', textTransform: 'uppercase', letterSpacing: '0.08em',
          color: project.is_paid ? C.accent : C.textFaint,
          background: project.is_paid ? C.accentHover : C.surfaceAlt,
          border: `1px solid ${project.is_paid ? C.accentBorder : C.border}`,
        }}>
          {project.is_paid ? 'Paid' : 'Unpaid'}
        </span>
      </div>

      {/* Type / mode badges */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {project.poster_type === 'student' && (
          <span style={{ fontSize: 9, fontFamily: F.mono, padding: '2px 7px', textTransform: 'uppercase', letterSpacing: '0.08em', color: C.accent, background: C.accentHover, border: `1px solid ${C.accentBorder}` }}>
            Student project
          </span>
        )}
        {project.type && (
          <span style={{ fontSize: 9, fontFamily: F.mono, padding: '2px 7px', textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textMuted, background: C.surfaceAlt, border: `1px solid ${C.border}` }}>
            {typeLabel[project.type] ?? project.type}
          </span>
        )}
        {project.work_mode && (
          <span style={{ fontSize: 9, fontFamily: F.mono, padding: '2px 7px', textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textMuted, background: C.surfaceAlt, border: `1px solid ${C.border}` }}>
            {project.work_mode}
          </span>
        )}
        {project.complexity_level && (
          <span style={{ fontSize: 9, fontFamily: F.mono, padding: '2px 7px', textTransform: 'uppercase', letterSpacing: '0.08em', color: project.complexity_level === 'advanced' ? '#DC2626' : C.textMuted, background: project.complexity_level === 'advanced' ? 'rgba(248,113,113,0.08)' : C.surfaceAlt, border: `1px solid ${project.complexity_level === 'advanced' ? 'rgba(248,113,113,0.25)' : C.border}` }}>
            {complexityLabel[project.complexity_level] ?? project.complexity_level}
          </span>
        )}
        {project.work_auth_required && (
          <span style={{ fontSize: 9, fontFamily: F.mono, padding: '2px 7px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#DC2626', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}>
            US Auth
          </span>
        )}
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 11, color: C.textFaint, fontFamily: F.mono, marginBottom: displaySkills.length > 0 ? 10 : 0 }}>
        {project.duration && <span>{project.duration}</span>}
        {project.hours_per_week && <span>{project.hours_per_week}h/week</span>}
        {project.compensation && <span style={{ color: C.textMuted }}>{project.compensation}</span>}
      </div>

      {/* Skills */}
      {displaySkills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {displaySkills.map((skill) => (
            <span key={skill} style={{ fontSize: 10, padding: '2px 7px', background: C.bg, border: `1px solid ${C.border}`, color: C.textFaint, fontFamily: F.mono }}>
              {skill}
            </span>
          ))}
          {extra > 0 && (
            <span style={{ fontSize: 10, padding: '2px 7px', background: C.bg, border: `1px solid ${C.border}`, color: C.textFaint, fontFamily: F.mono }}>
              +{extra}
            </span>
          )}
        </div>
      )}
    </Link>
  )
}
