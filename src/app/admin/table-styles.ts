// Table styling for the admin pages.
//
// Deliberately NOT in widgets.tsx, which is a `'use client'` module. A server
// component may import *components* across that boundary, but importing a
// plain object gets you a client-reference proxy — and reading a property off
// it throws at render time. Three admin pages did exactly that and crashed
// with an opaque "error occurred in the Server Components render", while the
// two pages that imported only components worked fine.
//
// A build passing proves nothing about this; the failure is at runtime.

import type { CSSProperties } from 'react'
import { C } from '@/lib/theme/dark-tokens'

export const tableStyles = {
  table: { width: '100%', borderCollapse: 'collapse' } as CSSProperties,
  th: {
    textAlign: 'left', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: C.textGhost, padding: '0 14px 9px 0',
    borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
  } as CSSProperties,
  td: {
    padding: '11px 14px 11px 0', borderBottom: `1px solid ${C.borderFaint}`,
    color: C.textSub, verticalAlign: 'top',
  } as CSSProperties,
  num: { fontVariantNumeric: 'tabular-nums' } as CSSProperties,
}
