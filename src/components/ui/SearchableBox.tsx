'use client'

import { useId } from 'react'
import { C, R } from '@/lib/theme/dark-tokens'
import { Icon } from '@/components/Icon'

/**
 * A list that stays the same height however much is in it.
 *
 * My Record grew with the person it described: someone with six repositories
 * got a page, someone with forty got a scroll, and the parts underneath —
 * the collaborations, the track record — moved further away the more work a
 * student had done. That is exactly backwards.
 *
 * So the list gets a ceiling and its own scrollbar, and above it a filter,
 * because a fixed-height box you cannot search is worse than a long page:
 * it hides things without giving you a way to ask for them.
 *
 * The filter only appears once there is enough to be worth filtering. A
 * search field over five rows is furniture.
 */
export default function SearchableBox({
  label,
  query,
  onQuery,
  placeholder,
  count,
  total,
  maxHeight = 340,
  searchable = true,
  emptyMessage = 'Nothing matches that.',
  children,
}: {
  /** Names the search field for a screen reader. Never rendered. */
  label: string
  query: string
  onQuery: (q: string) => void
  placeholder: string
  /** How many rows are showing after filtering. */
  count: number
  /** How many there are in total. */
  total: number
  maxHeight?: number
  searchable?: boolean
  emptyMessage?: string
  children: React.ReactNode
}) {
  const id = useId()
  const filtering = query.trim() !== ''

  return (
    <div>
      {searchable && (
        <div style={{ position: 'relative', marginBottom: 11 }}>
          <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: C.textGhost, display: 'flex', pointerEvents: 'none' }}>
            <Icon name="search" size={14} />
          </span>
          <label htmlFor={id} className="sr-only">{label}</label>
          <input
            id={id}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={placeholder}
            className="dk-input"
            style={{ paddingLeft: 36, paddingRight: filtering ? 36 : 14, fontSize: 14 }}
            type="search"
            autoComplete="off"
          />
          {filtering && (
            <button
              type="button"
              onClick={() => onQuery('')}
              aria-label="Clear search"
              style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', width: 22, height: 22, borderRadius: R.sm, border: 'none', background: 'none', color: C.textGhost, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="x" size={12} />
            </button>
          )}
        </div>
      )}

      {/* No fade over the last rows: it made them hard to read. The
          scrollbar says there is more below. */}
      <div style={{ position: 'relative' }}>
        <div
          style={{ maxHeight, overflowY: 'auto', overscrollBehavior: 'contain' }}
          className="nb-scroll"
        >
          {count === 0 ? (
            <p style={{ fontSize: 13.5, color: C.textFaint, padding: '18px 2px', lineHeight: 1.6 }}>
              {emptyMessage}
            </p>
          ) : (
            children
          )}
        </div>
      </div>

      {/* Says what is off-screen. A box that scrolls without saying how far
          is the reason people think a filtered list is the whole list. */}
      {filtering && (
        <p role="status" style={{ fontSize: 13, color: C.textGhost, marginTop: 10 }}>
          {count} of {total} shown
        </p>
      )}
    </div>
  )
}
