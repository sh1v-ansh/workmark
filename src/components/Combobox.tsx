'use client'

import { useState, useRef, useEffect } from 'react'
import { C, F } from '@/lib/theme/dark-tokens'

interface Props {
  id: string
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
  required?: boolean
}

export function Combobox({ id, value, onChange, options, placeholder, required }: Props) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = query.length > 0
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : []

  useEffect(() => { setQuery(value) }, [value])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery(value)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [value])

  function select(option: string) {
    onChange(option)
    setQuery(option)
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[highlighted]) select(filtered[highlighted])
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery(value)
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        id={id}
        type="text"
        value={query}
        required={required}
        autoComplete="off"
        placeholder={placeholder}
        className="dk-input"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`${id}-listbox`}
        aria-activedescendant={open && filtered[highlighted] ? `${id}-opt-${highlighted}` : undefined}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setHighlighted(0)
        }}
        onFocus={() => { setOpen(true); setHighlighted(0) }}
        onKeyDown={handleKeyDown}
      />
      {open && filtered.length > 0 && (
        <ul
          id={`${id}-listbox`}
          role="listbox"
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
            background: C.surface, border: `1px solid ${C.border}`, borderTop: 'none',
            maxHeight: 220, overflowY: 'auto', margin: 0, padding: 0, listStyle: 'none',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          {filtered.map((option, i) => (
            <li
              key={option}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={option === value}
              onMouseDown={(e) => { e.preventDefault(); select(option) }}
              onMouseEnter={() => setHighlighted(i)}
              style={{
                padding: '9px 14px',
                fontFamily: F.mono,
                fontSize: 12,
                color: i === highlighted ? C.text : C.textSub,
                background: i === highlighted ? C.accentHover : 'transparent',
                cursor: 'pointer',
                borderTop: i > 0 ? `1px solid ${C.border}` : 'none',
              }}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
