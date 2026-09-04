// Pasted legal documents.
//
// The preferred way to publish these is Termly's *embed*: set the
// NEXT_PUBLIC_TERMLY_*_ID env var and the live document is pulled in at
// render time, so amending it in Termly amends the page. Nothing needs to
// be pasted here at all.
//
// This file is the fallback for when only "Copy HTML" is available. Paste
// Termly's HTML between the backticks below and the page renders it. The
// cost is real and worth stating plainly: a pasted document is a snapshot.
// Change it in Termly and this file is silently out of date — which matters
// most for the cookie policy, whose table of cookies Termly re-scans and
// updates on its own.
//
// If you paste here AND set the env var, the env var wins.
//
// One gotcha: this is a JavaScript template literal, so a backtick or a
// `${` inside the pasted HTML will break the build. Termly's output
// contains neither, and if it ever does the build fails loudly rather than
// producing a broken page.

/** Slug → pasted HTML. Empty string means "nothing pasted". */
export const PASTED_HTML: Record<string, string> = {
  privacy: ``,

  terms: ``,

  'acceptable-use': ``,

  // ── Paste the Termly cookie policy HTML between these backticks ──
  cookies: ``,
}

export function pastedHtmlFor(slug: string): string | null {
  const html = PASTED_HTML[slug]?.trim()
  return html ? html : null
}
