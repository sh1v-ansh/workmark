import type { Project } from '@/lib/types'
import { C, F } from '@/lib/theme/dark-tokens'
import { tagColor } from '@/lib/theme/tagColors'
import Card from './Card'
import { Icon } from './Icon'

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
    <Card href={`/projects/${project.id}`} style={{ height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 4, lineHeight: 1.35, letterSpacing: '-0.01em' }}>
            {project.title ?? 'Untitled Project'}
          </h3>
          <p style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.textFaint }}>
            {project.poster_display_name ?? posterFallbackLabel(project.poster_type)}
            {(project.location || project.work_mode === 'remote') && (
              <>
                <span aria-hidden="true">·</span>
                <Icon name="map-pin" size={12} />
                {project.location ?? 'Remote'}
              </>
            )}
          </p>
        </div>
        <span style={{
          flexShrink: 0, fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 999,
          color: project.is_paid ? '#15803D' : C.textFaint,
          background: project.is_paid ? '#F0FDF4' : C.surfaceAlt,
          border: `1px solid ${project.is_paid ? '#BBF7D0' : C.border}`,
        }}>
          {project.is_paid ? 'Paid' : 'Unpaid'}
        </span>
      </div>

      {/* Type / mode badges */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {project.poster_type === 'student' && (
          <>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 999, color: C.accent, background: C.accentHover, border: `1px solid ${C.accentBorder}` }}>
              <Icon name="users" size={11} /> Student project
            </span>
            {(() => {
              const remaining = project.max_applicants - project.applicant_count
              return remaining <= 0 ? (
                <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 999, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA' }}>
                  Applications full
                </span>
              ) : (
                <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 999, color: remaining <= 3 ? '#B45309' : C.textMuted, background: remaining <= 3 ? '#FFFBEB' : C.surfaceAlt, border: `1px solid ${remaining <= 3 ? '#FDE68A' : C.border}` }}>
                  {remaining} of {project.max_applicants} spots left
                </span>
              )
            })()}
          </>
        )}
        {project.type && (
          <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 999, color: C.textMuted, background: C.surfaceAlt, border: `1px solid ${C.border}` }}>
            {typeLabel[project.type] ?? project.type}
          </span>
        )}
        {project.complexity_level && (
          <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 999, color: project.complexity_level === 'advanced' ? '#B91C1C' : C.textMuted, background: project.complexity_level === 'advanced' ? '#FEF2F2' : C.surfaceAlt, border: `1px solid ${project.complexity_level === 'advanced' ? '#FECACA' : C.border}` }}>
            {complexityLabel[project.complexity_level] ?? project.complexity_level}
          </span>
        )}
        {project.work_auth_required && (
          <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 999, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA' }}>
            US Auth
          </span>
        )}
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12, color: C.textFaint, marginBottom: displaySkills.length > 0 ? 12 : 0 }}>
        {project.duration && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="calendar" size={12} />{project.duration}</span>
        )}
        {project.hours_per_week && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="clock" size={12} />{project.hours_per_week}h/week</span>
        )}
        {project.compensation && <span style={{ color: C.textMuted, fontWeight: 500 }}>{project.compensation}</span>}
      </div>

      {/* Skills */}
      {displaySkills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {displaySkills.map((skill) => {
            const c = tagColor(skill)
            return (
              <span key={skill} style={{ fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 999, background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontFamily: F.mono }}>
                {skill}
              </span>
            )
          })}
          {extra > 0 && (
            <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.textFaint, fontFamily: F.mono }}>
              +{extra}
            </span>
          )}
        </div>
      )}
    </Card>
  )
}
