'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { C, R } from '@/lib/theme/dark-tokens'

/**
 * A closed list of checkboxes behind a button.
 *
 * The other filter facets are chips because their option sets are closed and
 * tiny — three work modes, three hour bands, four fit tiers, and they will
 * still be three, three and four next year. Skills are not: the list is
 * every skill across every open listing, so it grows with the platform. As
 * chips it was already eleven rows tall and pushing every other filter off
 * the screen.
 *
 * Search is inside rather than alongside, because past a couple of dozen
 * options scanning stops working and typing is the only way anyone finds
 * anything.
 */
export default function MultiSelect({
  label,
  options,
  selected,
  onToggle,
  onClear,
}: {
  label: string
  options: string[]
  selected: Set<string>
  onToggle: (value: string) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.toLowerCase().includes(q))
  }, [options, query])

  const count = selected.size

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.11em', textTransform: 'uppercase', color: C.textGhost }}>
          {label}
        </span>
        {count > 0 && (
          <button
            type="button"
            onClick={onClear}
            style={{ fontSize: 11.5, color: C.textFaint, background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit', textDecoration: 'underline' }}
          >
            Clear
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          fontSize: 13, color: count > 0 ? C.text : C.textMuted, background: C.surface,
          border: `1px solid ${count > 0 ? C.accent : C.border}`, borderRadius: R.md,
          padding: '8px 11px', cursor: 'pointer', font: 'inherit', textAlign: 'left',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {count === 0 ? `Any ${label.toLowerCase()}` : count === 1 ? Array.from(selected)[0] : `${count} selected`}
        </span>
        <span aria-hidden="true" style={{ fontSize: 10, color: C.textFaint, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          style={{
            position: 'absolute', top: 'calc(100% + 5px)', left: 0, right: 0, zIndex: 30,
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.md,
            boxShadow: '0 4px 6px rgba(25,30,46,0.04), 0 12px 32px rgba(25,30,46,0.12)',
            padding: 7, maxHeight: 280, display: 'flex', flexDirection: 'column', gap: 6,
          }}
        >
          {options.length > 8 && (
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}…`}
              aria-label={`Search ${label.toLowerCase()}`}
              className="dk-input"
              style={{ fontSize: 13, padding: '6px 9px' }}
            />
          )}

          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {matches.length === 0 ? (
              <p style={{ fontSize: 12.5, color: C.textFaint, padding: '8px 6px' }}>Nothing matches.</p>
            ) : (
              matches.map((o) => {
                const on = selected.has(o)
                return (
                  <label
                    key={o}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
                      color: on ? C.text : C.textSub, padding: '6px 6px', borderRadius: R.sm, cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => onToggle(o)}
                      style={{ width: 13, height: 13, accentColor: C.accent, flexShrink: 0 }}
                    />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o}</span>
                  </label>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
