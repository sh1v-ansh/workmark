'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/Toast'
import { C, R, T } from '@/lib/theme/dark-tokens'
import {
  SINGLE_QUESTIONS, RACE_ETHNICITY, US_STATES, type Eligibility,
} from '@/lib/profile/eligibility'

/**
 * "Opportunities just for you": optional identity questions, used only to
 * show a student programs they qualify for.
 *
 * The promise is said up front and kept in code: never shown to anyone,
 * never affects how work is judged (see lib/profile/eligibility.ts and the
 * isolation test).
 */
export default function EligibilitySection({ initial }: { initial: Eligibility }) {
  const { toast } = useToast()
  const [form, setForm] = useState<Eligibility>(initial)
  const [saved, setSaved] = useState<Eligibility>(initial)
  const [busy, setBusy] = useState(false)
  const dirty = JSON.stringify(form) !== JSON.stringify(saved)

  const set = <K extends keyof Eligibility>(key: K, value: Eligibility[K]) => setForm((f) => ({ ...f, [key]: value }))

  function toggleRace(value: string) {
    setForm((f) => {
      const has = f.race_ethnicity.includes(value)
      let next = has ? f.race_ethnicity.filter((v) => v !== value) : [...f.race_ethnicity, value]
      // "Prefer not to say" and a category do not go together.
      if (!has) next = value === 'prefer_not' ? ['prefer_not'] : next.filter((v) => v !== 'prefer_not')
      return { ...f, race_ethnicity: next }
    })
  }

  async function save() {
    setBusy(true)
    try {
      const res = await fetch('/api/account/eligibility', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not save that.')
      setSaved(form)
      toast('Saved.', 'success')
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Could not save that.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function clearAll() {
    if (!confirm('Delete all of these answers?')) return
    setBusy(true)
    try {
      const res = await fetch('/api/account/eligibility', { method: 'DELETE' })
      if (!res.ok) throw new Error('Could not delete that.')
      const empty: Eligibility = { ...form, use_for_opportunities: false, first_gen: null, military: null, gender: null, gender_self: null, race_ethnicity: [], disability: null, lgbtq: null, low_income: null, us_state: null, transfer: null, citizenship: null }
      setForm(empty)
      setSaved(empty)
      toast('Deleted.', 'success')
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Could not delete that.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const label: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: C.textSub, marginBottom: 6 }
  const chip = (on: boolean): React.CSSProperties => ({
    cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: on ? 600 : 500,
    padding: '6px 11px', borderRadius: R.pill,
    border: `1px solid ${on ? C.accent : C.border}`,
    background: on ? '#F4F1FF' : C.surface, color: on ? C.accent : C.text,
  })

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '12px 14px', borderRadius: R.md, background: C.surfaceAlt }}>
        <input
          type="checkbox"
          className="dk-checkbox"
          checked={form.use_for_opportunities}
          onChange={(e) => set('use_for_opportunities', e.target.checked)}
          style={{ marginTop: 3 }}
        />
        <span style={{ fontSize: T.bodySm, color: C.textSub, lineHeight: 1.55 }}>
          <strong style={{ color: C.text }}>Use my answers to show me programs I qualify for</strong>
          <span style={{ display: 'block', color: C.textMuted }}>Your answers are saved either way, but only used while this is on.</span>
        </span>
      </label>

      {SINGLE_QUESTIONS.map((q) => (
        <div key={q.key}>
          <span style={label}>{q.label}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {q.options.map((o) => {
              const on = form[q.key] === o.value
              return (
                <button key={o.value} type="button" aria-pressed={on} style={chip(on)} onClick={() => set(q.key, on ? null : o.value)}>
                  {o.label}
                </button>
              )
            })}
          </div>
          {q.key === 'gender' && form.gender === 'self_describe' && (
            <input
              className="dk-input"
              value={form.gender_self ?? ''}
              onChange={(e) => set('gender_self', e.target.value)}
              placeholder="In your own words"
              maxLength={60}
              style={{ marginTop: 8, maxWidth: 320 }}
              aria-label="Gender in your own words"
            />
          )}
        </div>
      ))}

      <div>
        <span style={label}>Race and ethnicity <span style={{ fontWeight: 400, color: C.textMuted }}>· choose all that apply</span></span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {RACE_ETHNICITY.map((o) => {
            const on = form.race_ethnicity.includes(o.value)
            return (
              <button key={o.value} type="button" aria-pressed={on} style={chip(on)} onClick={() => toggleRace(o.value)}>
                {o.label}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label htmlFor="elig-state" style={label}>US state you live in</label>
        <select
          id="elig-state"
          className="dk-select"
          value={form.us_state ?? ''}
          onChange={(e) => set('us_state', e.target.value || null)}
          style={{ maxWidth: 200 }}
        >
          <option value="">Not saying</option>
          {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Button variant="ink" size="sm" onClick={save} disabled={!dirty} busyLabel={busy ? 'Saving…' : null}>
          Save
        </Button>
        <button
          type="button"
          onClick={clearAll}
          disabled={busy}
          style={{ background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', fontSize: 13, color: C.textMuted, textDecoration: 'underline', cursor: 'pointer' }}
        >
          Delete all my answers
        </button>
      </div>
    </div>
  )
}
