import { C } from '@/lib/theme/dark-tokens'

/**
 * A drawn underline under a phrase in a heading.
 *
 * One per page, and only under the few words the whole page is about. Underlining a second phrase halves the emphasis of the
 * first, which is the opposite of the point.
 *
 * The stroke is drawn rather than a border so it keeps a slight hand-made
 * wobble at any width — `preserveAspectRatio="none"` stretches it to the
 * phrase, and the imperfection survives the stretch where a straight rule
 * would just look like a border.
 */
export default function Underline({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ position: 'relative', whiteSpace: 'nowrap' }}>
      {children}
      <svg
        viewBox="0 0 196 10"
        fill="none"
        aria-hidden="true"
        preserveAspectRatio="none"
        style={{ position: 'absolute', left: 0, bottom: -6, width: '100%', height: 9 }}
      >
        <path
          d="M2 6.5c34-3.4 68-4.6 102-3.6 30 .9 60 2.7 90 4.6"
          stroke={C.accent}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}
