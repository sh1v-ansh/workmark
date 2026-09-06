'use client'

import Link from 'next/link'
import Modal from '@/components/ui/Modal'
import { LevelBadge } from '@/components/skills/SkillChip'
import { C, R } from '@/lib/theme/dark-tokens'
import { LEVEL_NAMES, LEVEL_DESCRIPTIONS } from '@/lib/skills/level-names'

export interface SkillEvidence {
  repoFullName: string | null
  tier: string | null
  level: number
  verificationMethod: string
}

const TIER_LABEL: Record<string, string> = {
  tier_0: 'Solo project',
  tier_0_5: 'Multi-contributor project',
  listing_driven: 'Collaboration on Workmark',
}

/**
 * Verification methods were rendering as their raw database values —
 * 'repo_link', 'human_review'. These are read by students disputing their
 * own record, so they have to be words.
 */
const VERIFICATION_LABEL: Record<string, string> = {
  repo_link: 'Read from the repository',
  deployment: 'Confirmed by a live deployment',
  package: 'Confirmed by a published package',
  ci: 'Confirmed by CI',
  human_review: 'Reviewed by a person',
  attested: 'Confirmed by a collaborator',
}

/**
 * Where one skill came from.
 *
 * This used to be an accordion row that pushed the rest of the list down the
 * page, so reading about the fourth of thirty-seven skills moved the other
 * thirty-three. A modal is the right shape here because the list behind is
 * something you were browsing, not something you are answering — the moment
 * you click a skill, that skill is the only thing that matters.
 *
 * What it must never become is a summary. The claim this product makes is
 * that every level is checkable, so this shows the actual projects and the
 * actual method, and links out to a dispute if the student thinks it is
 * wrong.
 */
export default function SkillEvidenceModal({
  skill,
  onClose,
}: {
  skill: { skillId: string; name: string; bestLevel: number; evidence: SkillEvidence[] } | null
  onClose: () => void
}) {
  const open = skill !== null
  const description = skill ? LEVEL_DESCRIPTIONS[skill.bestLevel] : null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={skill?.name ?? ''}
      subtitle={
        skill ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <LevelBadge level={skill.bestLevel} />
            <span>
              from {skill.evidence.length} project{skill.evidence.length === 1 ? '' : 's'}
            </span>
          </span>
        ) : undefined
      }
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: C.textGhost }}>Think this is wrong?</span>
          <Link href="/me/file" style={{ fontSize: 13, fontWeight: 600, color: C.accent, textDecoration: 'none' }}>
            Challenge it →
          </Link>
        </div>
      }
    >
      {skill && (
        <>
          {description && (
            <p style={{ fontSize: 13.5, color: C.textMuted, lineHeight: 1.6, marginBottom: 17 }}>
              {description}
            </p>
          )}

          <p style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.075em', textTransform: 'uppercase', color: C.textGhost, marginBottom: 10 }}>
            Where it came from
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {skill.evidence.map((e, i) => (
              <div
                key={`${e.repoFullName}-${i}`}
                style={{ background: C.surfaceAlt, borderRadius: R.md, padding: '12px 14px' }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                  {e.verificationMethod === 'repo_link' && e.repoFullName ? (
                    <a
                      href={`https://github.com/${e.repoFullName}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      style={{ fontSize: 13.5, fontWeight: 600, color: C.accent, textDecoration: 'none', wordBreak: 'break-word' }}
                    >
                      {e.repoFullName} ↗
                    </a>
                  ) : (
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: C.text, wordBreak: 'break-word' }}>
                      {e.repoFullName ?? 'Non-code work'}
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: C.textGhost, whiteSpace: 'nowrap' }}>
                    {LEVEL_NAMES[e.level] ?? `Level ${e.level}`}
                  </span>
                </div>
                <p style={{ fontSize: 12.5, color: C.textFaint, lineHeight: 1.5 }}>
                  {[TIER_LABEL[e.tier ?? ''] ?? e.tier, VERIFICATION_LABEL[e.verificationMethod] ?? e.verificationMethod]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  )
}
