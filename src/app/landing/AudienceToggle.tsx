'use client'

import { COPY, type Audience } from './audience'

/**
 * The switch between the two stories.
 *
 * A segmented control rather than two tabs or two separate pages, because
 * this is a preference about who is reading rather than a place to go — and
 * because a business landing on the student page should be able to fix that
 * in one click without losing the page.
 *
 * The moving pill is a real element rather than a background swap on the
 * active button, so the selection slides between the options instead of
 * blinking. That is the whole reason to build a segmented control by hand.
 */
export function AudienceToggle({
  value,
  onChange,
}: {
  value: Audience
  onChange: (next: Audience) => void
}) {
  const options: Audience[] = ['students', 'businesses']
  const index = options.indexOf(value)

  return (
    <div
      className="wm-toggle"
      role="tablist"
      aria-label="Who is this for"
    >
      <span className="wm-toggle-pill" style={{ transform: `translateX(${index * 100}%)` }} aria-hidden="true" />
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="tab"
          aria-selected={value === option}
          onClick={() => onChange(option)}
          className={`wm-toggle-option${value === option ? ' wm-toggle-option-active' : ''}`}
        >
          {COPY[option].tab}
        </button>
      ))}
    </div>
  )
}
