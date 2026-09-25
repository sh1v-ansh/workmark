'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/Toast'
import { C, F, R } from '@/lib/theme/dark-tokens'
import { CAREER_TRACKS, trackById } from '@/lib/careers/tracks'
import { buildLink, type CareerView } from '@/lib/careers/load'
import { levelName } from '@/lib/skills/level-names'

/**
 * Your career path: pick a track, see how far along it you are and the one
 * skill to build next. Everything here comes from verified work.
 */
export default function CareerCard({ view }: { view: CareerView }) {
  const router = useRouter()
  const { toast } = useToast()
  const [track, setTrack] = useState(view.trackId ?? '')
  const [aspiration, setAspiration] = useState(view.aspiration ?? '')
  const [editing, setEditing] = useState(!view.trackId)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/profile/career', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track: track || null, aspiration }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not save.')
      setEditing(false)
      router.refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const current = trackById(view.trackId)
  const p = view.progress
  const name = (id: string) => view.names[id] ?? id

  if (editing || !current || !p) {
    return (
      <Card hoverable={false} padding="20px 22px" style={{ marginBottom: 22 }}>
        <h2 style={{ fontFamily: F.display, fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 4 }}>Your career path</h2>
        <p style={{ fontSize: 14.5, color: C.textMuted, lineHeight: 1.6, marginBottom: 16, maxWidth: '60ch' }}>
          Pick where you are headed and we&apos;ll point you to the next skill to build, based on your verified work.
        </p>
        <div style={{ display: 'grid', gap: 12, maxWidth: 520 }}>
          <select className="dk-select" value={track} onChange={(e) => setTrack(e.target.value)} aria-label="Career">
            <option value="">Not sure yet</option>
            {CAREER_TRACKS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {track && <p style={{ fontSize: 14, color: C.textFaint }}>{trackById(track)?.blurb}</p>}
          <textarea
            className="dk-input" rows={2} maxLength={500} value={aspiration}
            onChange={(e) => setAspiration(e.target.value)}
            placeholder="Optional: what do you want to become? For example, I want to build ML tools for healthcare."
            aria-label="What you want to become" style={{ resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" onClick={save} busyLabel={saving ? 'Saving…' : null}>Save</Button>
            {view.trackId && <Button size="sm" variant="quiet" onClick={() => setEditing(false)}>Cancel</Button>}
          </div>
        </div>
      </Card>
    )
  }

  const pct = Math.round((p.done / p.total) * 100)
  const stages = [1, 2, 3].map((n) => p.slots.filter((s) => s.slot.stage === n)).filter((g) => g.length > 0)

  return (
    <Card hoverable={false} padding="20px 22px" style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        <h2 style={{ fontFamily: F.display, fontSize: 18, fontWeight: 600, color: C.text }}>
          {current.name} path
        </h2>
        <button type="button" onClick={() => setEditing(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: C.accent, fontFamily: 'inherit' }}>
          Change
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div style={{ flex: 1, height: 8, borderRadius: 99, background: C.surfaceAlt, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: 'linear-gradient(90deg, #7F5CFF, #A78BFA)' }} />
        </div>
        <span style={{ fontSize: 14, color: C.textMuted, whiteSpace: 'nowrap' }}>{p.done} of {p.total} skills</span>
      </div>

      {p.next ? (
        <div style={{ padding: '14px 16px', borderRadius: R.md, background: '#F6F3FF', border: '1px solid #E4DCFF', marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#6D4AFF', marginBottom: 3 }}>Next skill</p>
            <p style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{name(p.next.skillId)}</p>
            <p style={{ fontSize: 14, color: C.textMuted, marginTop: 2 }}>
              {p.next.currentLevel > 0
                ? `You're ${levelName(p.next.currentLevel)}. ${current.name}s need ${levelName(p.next.targetLevel)}.`
                : `Not on your record yet. ${current.name}s need ${levelName(p.next.targetLevel)}.`}
            </p>
          </div>
          <Button size="sm" variant="accent" href={buildLink(p.next.skillId, name(p.next.skillId), p.next.currentLevel)}>
            Get a project for it
          </Button>
        </div>
      ) : (
        <p style={{ fontSize: 14.5, color: C.textMuted, marginBottom: 18 }}>
          You have verified every skill on this path. Keep building to push them higher.
        </p>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {stages.map((group, i) => (
          <div key={i}>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.textFaint, marginBottom: 6 }}>Step {i + 1}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {group.map((s) => {
                const partial = !s.done && s.level > 0
                return (
                  <span
                    key={s.slot.label}
                    title={s.slot.skills.map(name).join(', ')}
                    style={{
                      fontSize: 14, padding: '4px 11px', borderRadius: 99,
                      border: `1px solid ${s.done ? '#C9EBD3' : partial ? '#E4DCFF' : C.border}`,
                      background: s.done ? '#EFFAF2' : partial ? '#F6F3FF' : 'transparent',
                      color: s.done ? '#1F7A3F' : partial ? '#5B3FD9' : C.textMuted,
                    }}
                  >
                    {s.done ? '✓ ' : ''}{s.level > 0 ? name(s.skillId) : s.slot.label}
                  </span>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
