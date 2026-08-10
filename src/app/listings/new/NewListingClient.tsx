'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Card from '@/components/Card'
import { useToast } from '@/components/Toast'
import SkillPicker, { type TaxonomySkill, type PickedRequirement } from '@/components/SkillPicker'
import { C, F } from '@/lib/theme/dark-tokens'

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} style={{ display: 'block', fontFamily: F.mono, fontSize: 10, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
      {children}
    </label>
  )
}

export default function NewListingClient({ studentName, taxonomy }: {
  studentName: string | null
  taxonomy: TaxonomySkill[]
}) {
  const router = useRouter()
  const { toast } = useToast()

  const [title, setTitle] = useState('')
  const [brief, setBrief] = useState('')
  const [requirements, setRequirements] = useState<PickedRequirement[]>([])
  const [hoursPerWeek, setHoursPerWeek] = useState('')
  const [estHours, setEstHours] = useState('')
  const [duration, setDuration] = useState('')
  const [workMode, setWorkMode] = useState('remote')
  const [teamSize, setTeamSize] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (requirements.length === 0) {
      toast('Add at least one required skill so applicants can be matched.', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          brief,
          est_hours: estHours ? parseInt(estHours) : null,
          hours_per_week: hoursPerWeek ? parseInt(hoursPerWeek) : null,
          duration: duration || null,
          work_mode: workMode || null,
          team_size: teamSize ? parseInt(teamSize) : null,
          declared_difficulty: difficulty ? parseInt(difficulty) : null,
          requirements: requirements.map((r) => ({ skillId: r.skillId, requiredLevel: r.requiredLevel })),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not create the listing.')
      toast('Project posted.', 'success')
      router.push(`/listings/${json.id}`)
      router.refresh()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Could not create the listing.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const gap: React.CSSProperties = { display: 'flex', flexDirection: 'column' }

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <Navbar role="student" userName={studentName ?? undefined} />

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={{ fontFamily: F.serif, fontSize: 26, fontWeight: 700, color: C.text, marginBottom: 6 }}>
          Post a project
        </h1>
        <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 24 }}>
          Applicants are matched on whether their linked repos actually demonstrate the skills you list.
        </p>

        <Card hoverable={false} padding={28}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={gap}>
              <FieldLabel htmlFor="listing-title">Title <span aria-hidden="true" style={{ color: C.accent }}>*</span><span className="sr-only"> (required)</span></FieldLabel>
              <input id="listing-title" required value={title} onChange={(e) => setTitle(e.target.value)} className="dk-input" placeholder="Build a real-time collaboration backend" />
            </div>

            <div style={gap}>
              <FieldLabel htmlFor="listing-brief">What needs building <span aria-hidden="true" style={{ color: C.accent }}>*</span><span className="sr-only"> (required)</span></FieldLabel>
              <textarea
                id="listing-brief" required value={brief} onChange={(e) => setBrief(e.target.value)}
                rows={6} className="dk-input" style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
                placeholder="What the project is, what the collaborator would own, and what done looks like."
              />
            </div>

            <div>
              <FieldLabel htmlFor="listing-skills">Required skills <span aria-hidden="true" style={{ color: C.accent }}>*</span><span className="sr-only"> (required)</span></FieldLabel>
              <SkillPicker taxonomy={taxonomy} value={requirements} onChange={setRequirements} />
            </div>

            <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={gap}>
                <FieldLabel htmlFor="listing-hpw">Hours per week</FieldLabel>
                <input id="listing-hpw" type="number" min={1} max={60} value={hoursPerWeek} onChange={(e) => setHoursPerWeek(e.target.value)} className="dk-input" placeholder="10" />
              </div>
              <div style={gap}>
                <FieldLabel htmlFor="listing-est">Total hours (estimate)</FieldLabel>
                <input id="listing-est" type="number" min={1} value={estHours} onChange={(e) => setEstHours(e.target.value)} className="dk-input" placeholder="60" />
              </div>
              <div style={gap}>
                <FieldLabel htmlFor="listing-duration">Duration</FieldLabel>
                <input id="listing-duration" value={duration} onChange={(e) => setDuration(e.target.value)} className="dk-input" placeholder="6 weeks" />
              </div>
              <div style={gap}>
                <FieldLabel htmlFor="listing-mode">Work mode</FieldLabel>
                <select id="listing-mode" value={workMode} onChange={(e) => setWorkMode(e.target.value)} className="dk-select">
                  <option value="remote">Remote</option>
                  <option value="in-person">In person</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
              <div style={gap}>
                <FieldLabel htmlFor="listing-team">Team size</FieldLabel>
                <input id="listing-team" type="number" min={1} max={20} value={teamSize} onChange={(e) => setTeamSize(e.target.value)} className="dk-input" placeholder="2" />
              </div>
              <div style={gap}>
                <FieldLabel htmlFor="listing-difficulty">Difficulty (1–10)</FieldLabel>
                <input id="listing-difficulty" type="number" min={1} max={10} value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="dk-input" placeholder="6" />
              </div>
            </div>

            <button
              type="submit" disabled={saving}
              style={{ width: '100%', padding: '12px 0', background: saving ? C.surfaceAlt : C.accent, color: saving ? C.textMuted : C.bg, fontFamily: F.mono, fontSize: 13, fontWeight: 500, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em' }}
            >
              {saving ? 'Posting…' : 'Post project →'}
            </button>
          </form>
        </Card>
      </main>
    </div>
  )
}
