'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import SkillPicker, { type TaxonomySkill, type PickedRequirement } from '@/components/SkillPicker'
import { useToast } from '@/components/Toast'
import { createClient } from '@/lib/supabase/client'
import { C, R, T } from '@/lib/theme/dark-tokens'
import { MAX_WORKSPACE_MEMBERS } from '@/lib/workspace/membership'

const KINDS = [
  { key: 'collaborative', label: 'Collaborative project' },
  { key: 'startup', label: 'Student startup' },
] as const

/**
 * "Find collaborators": turn this project into a public posting on Find
 * work, or take it down again. Owners only; the header decides that.
 *
 * Asks only what a stranger needs to decide whether to apply: what kind of
 * project it is, what it is, which skills it needs, how many people and how
 * much time. The title is the project's own.
 */
export default function PublishProject({
  workspaceId, summary, seated, listingId, listingOpen,
}: {
  workspaceId: string
  summary: string | null
  /** Everyone on the team plus unanswered invites. */
  seated: number
  listingId: string | null
  listingOpen: boolean
}) {
  const router = useRouter()
  const { toast } = useToast()
  const room = MAX_WORKSPACE_MEMBERS - seated

  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [taxonomy, setTaxonomy] = useState<TaxonomySkill[] | null>(null)
  const [kind, setKind] = useState<'collaborative' | 'startup'>('collaborative')
  const [brief, setBrief] = useState(summary ?? '')
  const [requirements, setRequirements] = useState<PickedRequirement[]>([])
  const [maxCollaborators, setMaxCollaborators] = useState(Math.min(2, Math.max(1, room)))
  const [hoursPerWeek, setHoursPerWeek] = useState('')

  async function openForm() {
    setOpen(true)
    if (!taxonomy) {
      const { data } = await createClient()
        .from('skills')
        .select('id, canonical_name, parent_id')
        .is('deprecated_at', null)
        .order('canonical_name')
      setTaxonomy((data ?? []) as TaxonomySkill[])
    }
  }

  async function publish() {
    if (brief.trim().length < 20) {
      toast('Say a little more about the project so people know what they are joining.', 'error')
      return
    }
    if (requirements.length === 0) {
      toast('Add at least one skill you need.', 'error')
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          brief: brief.trim(),
          maxCollaborators,
          hours_per_week: hoursPerWeek ? parseInt(hoursPerWeek) : null,
          work_mode: 'remote',
          requirements: requirements.map((r) => ({ skillId: r.skillId, requiredLevel: r.requiredLevel })),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not publish the project.')
      toast('Your project is on Find work. Applicants show up in the posting.', 'success')
      setOpen(false)
      router.refresh()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Could not publish the project.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function takeDown() {
    if (!confirm('Take this project off Find work? Applications already in stay on record.')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/publish`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not take it down.')
      toast('Taken off Find work.', 'success')
      router.refresh()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Could not take it down.', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (listingOpen && listingId) {
    return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button href={`/listings/${listingId}/applicants`} variant="accent" size="sm">See applicants</Button>
        <Button href={`/listings/${listingId}`} variant="outline" size="sm">View posting</Button>
        <Button variant="quiet" size="sm" onClick={takeDown} busyLabel={busy ? 'Working…' : null}>Take down</Button>
      </div>
    )
  }

  if (room < 1) return null

  const label: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: C.textSub, marginBottom: 6 }

  return (
    <>
      <Button variant="accent" size="sm" onClick={openForm}>Find collaborators</Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Find collaborators"
        subtitle="Post this project on Find work. People you accept join this project."
        width={600}
      >
        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <span style={label}>What kind of project is it?</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {KINDS.map((k) => {
                const on = kind === k.key
                return (
                  <button
                    key={k.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setKind(k.key)}
                    style={{
                      cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
                      padding: '8px 14px', borderRadius: R.md,
                      border: `1px solid ${on ? C.accent : C.border}`,
                      background: on ? '#F4F1FF' : C.surface, color: on ? C.accent : C.text,
                    }}
                  >
                    {k.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label htmlFor="pub-brief" style={label}>What you are building and who you need</label>
            <textarea
              id="pub-brief"
              className="dk-textarea"
              rows={4}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="What the project does, what is already built, and what a collaborator would own."
              style={{ fontFamily: 'inherit', fontSize: 14, lineHeight: 1.6 }}
            />
          </div>

          <div>
            <span style={label}>Skills you need</span>
            {taxonomy
              ? <SkillPicker taxonomy={taxonomy} value={requirements} onChange={setRequirements} />
              : <p style={{ fontSize: T.bodySm, color: C.textMuted }}>Loading skills…</p>}
          </div>

          <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label htmlFor="pub-max" style={label}>How many collaborators</label>
              <select
                id="pub-max"
                className="dk-select"
                value={maxCollaborators}
                onChange={(e) => setMaxCollaborators(parseInt(e.target.value))}
              >
                {Array.from({ length: room }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pub-hours" style={label}>Hours per week</label>
              <input
                id="pub-hours"
                className="dk-input"
                type="number"
                min={1}
                max={60}
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(e.target.value)}
                placeholder="5"
              />
            </div>
          </div>

          <Button variant="accent" fullWidth onClick={publish} busyLabel={busy ? 'Publishing…' : null}>
            Post on Find work
          </Button>
        </div>
      </Modal>
    </>
  )
}
