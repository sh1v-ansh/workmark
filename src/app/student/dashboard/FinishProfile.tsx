'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import { Combobox } from '@/components/Combobox'
import { useToast } from '@/components/Toast'
import { MAJORS } from '@/lib/data/majors'
import { C, T } from '@/lib/theme/dark-tokens'

/**
 * The fields signup stopped asking for.
 *
 * ── Why here, and why now ─────────────────────────────────────────────────
 * Signup used to ask for eighteen things before showing anything, and every
 * field before somebody had seen the point was a chance to leave. None of
 * these is needed to produce a record, so they moved to after the first
 * scan: at that moment a student has something on screen that these make
 * more useful — a poster filtering for part-time help, a profile with a
 * LinkedIn beside the evidence.
 *
 * Only shown once there is a record, and gone once the major is filled in.
 * Every field is optional, because an incomplete profile with a real record
 * is worth far more than a complete one without.
 */
export default function FinishProfile() {
  const router = useRouter()
  const { toast } = useToast()
  const [major, setMajor] = useState('')
  const [availability, setAvailability] = useState('')
  const [hours, setHours] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [busy, setBusy] = useState(false)
  // A one-line notice until asked for; the four fields only open on click.
  const [open, setOpen] = useState(false)

  async function save() {
    setBusy(true)
    try {
      const res = await fetch('/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          details: {
            major: major || null,
            availability: availability || null,
            hours_per_week: hours || null,
            linkedin_url: linkedin || null,
          },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not save that.')
      toast('Saved.', 'success')
      router.refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save that.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const label: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: C.textSub, marginBottom: 6 }

  if (!open) {
    return (
      <Card hoverable={false} padding="12px 16px" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <p style={{ fontSize: T.bodySm, color: C.textSub }}>
            <strong style={{ fontWeight: 600, color: C.text }}>Finish your profile</strong>
            <span style={{ color: C.textMuted }}> · major, availability and LinkedIn help posters find you</span>
          </p>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Add details</Button>
        </div>
      </Card>
    )
  }

  return (
    <Card hoverable={false} padding={18} style={{ marginBottom: 12 }}>
      <p style={{ fontSize: T.bodySm, fontWeight: 600, color: C.text, marginBottom: 12 }}>
        Finish your profile <span style={{ fontWeight: 400, color: C.textMuted }}>· all optional</span>
      </p>

      <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="fp-major" style={label}>Major</label>
          <Combobox id="fp-major" value={major} onChange={setMajor} options={MAJORS} placeholder="Search majors…" />
        </div>
        <div>
          <label htmlFor="fp-availability" style={label}>Availability</label>
          <select id="fp-availability" value={availability} onChange={(e) => setAvailability(e.target.value)} className="dk-select">
            <option value="">Not saying</option>
            <option value="part-time">Part-time</option>
            <option value="full-time">Full-time</option>
          </select>
        </div>
        <div>
          <label htmlFor="fp-hours" style={label}>Hours a week</label>
          <input id="fp-hours" type="number" min={1} max={60} value={hours} onChange={(e) => setHours(e.target.value)} className="dk-input" placeholder="10" />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="fp-linkedin" style={label}>LinkedIn</label>
          <input id="fp-linkedin" type="url" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} className="dk-input" placeholder="https://linkedin.com/in/you" />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <Button onClick={save} busyLabel={busy ? 'Saving…' : null} disabled={!major && !availability && !hours && !linkedin}>
          Save
        </Button>
        {/* On your own profile page, in a private section nobody else sees:
            these answers only decide which programs are shown. */}
        <a href="/me#opportunities" style={{ fontSize: 13, color: C.accent }}>
          Some programs are only for certain groups. Check if you qualify
        </a>
      </div>
    </Card>
  )
}
