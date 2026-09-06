'use client'

import Link from 'next/link'
import { Icon } from '@/components/Icon'
import { C, F, R } from '@/lib/theme/dark-tokens'
import { REASON_COPY, type RecommendationReason } from '@/lib/briefs/targets'

export interface AiProjectCardData {
  id: string
  title: string
  summary: string
  skillName: string | null
  reason: RecommendationReason | null
  /** 1 = a weekend, 5 = several weeks. */
  difficulty: number | null
}

const DIFFICULTY_LABEL: Record<number, string> = {
  1: 'A weekend',
  2: 'About a week',
  3: 'A couple of weeks',
  4: 'Three or four weeks',
  5: 'A month or more',
}

/**
 * A project Workmark wrote, sitting among projects people posted.
 *
 * The whole design problem is that these must never be mistaken for the
 * other thing. A student applying to a real listing is contacting a person
 * who will read it; "applying" to one of these is opening an editor. So it
 * is signed Workmark AI, it says "generated for you", and its verb is Start
 * rather than Apply.
 *
 * Violet is doing that work — a tinted ground, a violet edge, and light
 * pooling in the corner, against the flat white of a real posting. It is
 * the only place in the product where violet fills a card rather than
 * marking an action, and that exception is the point: nothing else on the
 * page looks like this because nothing else on the page is this.
 */
export default function AiProjectCard({ project }: { project: AiProjectCardData }) {
  const reason = project.reason ? REASON_COPY[project.reason] : null

  return (
    <Link href={`/me/briefs#brief-${project.id}`} className="nb-ai-card">
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 11, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6.5, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.accentInk }}>
            <Icon name="spark" size={13} />
            Workmark AI
          </span>
          {reason && (
            <span style={{ fontSize: 11.5, fontWeight: 600, color: C.accentInk, background: 'rgba(97,66,245,0.10)', border: '1px solid rgba(97,66,245,0.18)', borderRadius: R.pill, padding: '3px 9px' }}>
              {reason.label}
            </span>
          )}
        </div>

        <h2 style={{ fontFamily: F.display, fontSize: 16, fontWeight: 600, letterSpacing: '-0.015em', color: C.text, lineHeight: 1.3, marginBottom: 8 }}>
          {project.title}
        </h2>

        <p style={{
          fontSize: 13.5, color: C.textMuted, lineHeight: 1.55, marginBottom: 11,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {project.summary}
        </p>

        {/* Why this one, in the student's terms. A recommendation that
            cannot say why it is here is an advert. */}
        {reason && project.skillName && (
          <p style={{ fontSize: 12.5, color: C.textFaint, lineHeight: 1.5, marginBottom: 13 }}>
            {reason.explain(project.skillName)}
          </p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 11, fontSize: 12.5, color: C.textGhost }}>
            {project.skillName && <span>Builds {project.skillName}</span>}
            {project.difficulty != null && <span>{DIFFICULTY_LABEL[project.difficulty] ?? ''}</span>}
          </span>
          {/* Start, not Apply. Nobody is waiting to read this. */}
          <span style={{ fontSize: 13, fontWeight: 600, color: C.accent, whiteSpace: 'nowrap' }}>
            Start this →
          </span>
        </div>
      </div>
    </Link>
  )
}
