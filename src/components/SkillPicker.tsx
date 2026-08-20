'use client'

import { useState, useMemo } from 'react'
import { C, F, R, E } from '@/lib/theme/dark-tokens'
import { tagColor } from '@/lib/theme/tagColors'

// Picks from the fixed taxonomy only — free text isn't accepted here.
// A listing requirement has to reference a real skills.id (it's a foreign
// key), and more importantly matching compares a listing's skill_id
// against a student's evidence skill_id: an unrecognised string can never
// match anything, so silently accepting one would produce a listing that
// looks fine and matches nobody.

export interface TaxonomySkill {
  id: string
  canonical_name: string
  parent_id: string | null
}

export interface PickedRequirement {
  skillId: string
  canonicalName: string
  requiredLevel: number
}

const IMPORTANCE_LABEL: Record<number, string> = {
  1: 'Nice to have',
  2: 'Helpful',
  3: 'Important',
  4: 'Core',
  5: 'Essential',
}

export default function SkillPicker({ taxonomy, value, onChange, max = 8 }: {
  taxonomy: TaxonomySkill[]
  value: PickedRequirement[]
  onChange: (next: PickedRequirement[]) => void
  max?: number
}) {
  const [query, setQuery] = useState('')

  const chosen = useMemo(() => new Set(value.map((v) => v.skillId)), [value])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return taxonomy
      .filter((s) => !chosen.has(s.id) && (s.canonical_name.toLowerCase().includes(q) || s.id.includes(q)))
      .slice(0, 8)
  }, [query, taxonomy, chosen])

  function add(skill: TaxonomySkill) {
    if (value.length >= max) return
    onChange([...value, { skillId: skill.id, canonicalName: skill.canonical_name, requiredLevel: 3 }])
    setQuery('')
  }

  function setLevel(skillId: string, level: number) {
    onChange(value.map((v) => (v.skillId === skillId ? { ...v, requiredLevel: level } : v)))
  }

  function remove(skillId: string) {
    onChange(value.filter((v) => v.skillId !== skillId))
  }

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={value.length >= max ? `Maximum ${max} skills` : 'Search skills — e.g. React, Postgres, FastAPI'}
          disabled={value.length >= max}
          className="dk-input"
          aria-label="Search skills"
        />
        {matches.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: 4, background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.md, overflow: 'hidden', boxShadow: E.overlay }}>
            {matches.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => add(s)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 15px', background: 'transparent', border: 'none', color: C.textSub, fontSize: 15, cursor: 'pointer', font: 'inherit' }}
              >
                {s.canonical_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {query.trim() && matches.length === 0 && value.length < max && (
        <p style={{ fontSize: 11, color: C.textFaint, marginTop: 6, lineHeight: 1.5 }}>
          Nothing in the taxonomy matches that. Only recognised skills can be required — an unrecognised one would match nobody.
        </p>
      )}

      {value.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {value.map((req) => {
            const c = tagColor(req.canonicalName)
            return (
              <div key={req.skillId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 12px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontFamily: F.mono }}>
                  {req.canonicalName}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <select
                    value={req.requiredLevel}
                    onChange={(e) => setLevel(req.skillId, Number(e.target.value))}
                    className="dk-select"
                    style={{ fontSize: 12, padding: '4px 8px' }}
                    aria-label={`Importance of ${req.canonicalName}`}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>{IMPORTANCE_LABEL[n]}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => remove(req.skillId)} aria-label={`Remove ${req.canonicalName}`} style={{ background: 'none', border: 'none', color: C.textFaint, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 4px' }}>
                    <span aria-hidden="true">×</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p style={{ fontSize: 11, color: C.textFaint, marginTop: 10, lineHeight: 1.5 }}>
        Importance tells applicants what matters most — it is not a minimum bar. Anyone with evidence in a skill can apply; importance only affects how applicants are ranked.
      </p>
    </div>
  )
}
