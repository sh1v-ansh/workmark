// What a Workmark email looks like.
//
// ── The constraint that shapes all of this ────────────────────────────────
// No images, no web fonts, no external stylesheet, no tracking pixel. Not an
// aesthetic choice: a young sending domain has no reputation, and remote
// content is the single biggest thing that gets a message filtered or
// clipped. Everything here is inline styles on tables, which is the one
// layout method every mail client from Outlook 2007 onwards agrees about.
//
// So the design has to be carried by type, spacing, one rule and one colour.
// That happens to be what the app looks like anyway.
//
// ── Why tables ────────────────────────────────────────────────────────────
// Outlook on Windows renders through Word, which has no flexbox, no grid, no
// max-width on divs and no border-radius. A table with a fixed width and
// padding on the cell is the only structure that survives it. This looks
// like 2005 HTML because mail clients are, in a real sense, still in 2005.

/** The brand, as literal values. A mail client cannot read a CSS variable. */
const INK = '#191E2E'
const SUB = '#2B3244'
const MUTED = '#5A6172'
const GHOST = '#8D94A5'
const ACCENT = '#6142F5'
const PAPER = '#FFFFFF'
const GROUND = '#F4F4F8'
const EDGE = '#CFD2E0'
const HAIRLINE = '#ECEBF3'

// Instrument Sans is the app's face and will not load here — a web font in
// email is a remote resource, which is the thing this file exists to avoid.
// This stack picks the nearest grotesque each platform already has.
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif"

export interface Rendered {
  html: string
  text: string
}

export interface TemplateArgs {
  /** The message. Blank lines separate paragraphs. */
  body: string
  /** The single call to action, when there is one. */
  link?: { url: string; label: string } | null
  /** Where "unsubscribe" or "manage settings" goes, and what it says. */
  footerLink: { url: string; label: string }
  /**
   * Required by CAN-SPAM on anything that is not transactional. Passed in
   * rather than read here so the caller is the one that has to have decided.
   */
  postalAddress?: string | null
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * The line an inbox shows next to the subject.
 *
 * Without one, Gmail and Apple Mail pull whatever text comes first in the
 * document — which, in a designed email, is the word in the logo. Every
 * message in the list then previews as "Workmark Workmark Workmark".
 */
function preheader(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim().slice(0, 140)
  // Hidden every way the major clients respect, then padded, because
  // Gmail otherwise continues into whatever text follows.
  return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${PAPER};opacity:0">`
    + `${escapeHtml(flat)}${'&#847;&zwnj;&nbsp;'.repeat(60)}</div>`
}

/**
 * The mark, drawn rather than fetched.
 *
 * The same violet square with a W in it that the app puts beside anything
 * Workmark says. As a background colour on a table cell it survives Outlook;
 * as an <img> it would be blocked by default in most clients, which is
 * exactly the wrong first impression.
 */
function wordmark(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>`
    + `<td width="22" height="22" align="center" valign="middle" bgcolor="${ACCENT}"`
    + ` style="width:22px;height:22px;border-radius:6px;background:${ACCENT};color:${PAPER};`
    + `font-family:${FONT};font-size:12px;font-weight:700;line-height:22px;text-align:center">W</td>`
    + `<td style="padding-left:9px;font-family:${FONT};font-size:15px;font-weight:600;`
    + `letter-spacing:-0.01em;color:${INK}">Workmark</td>`
    + `</tr></table>`
}

/**
 * A button that is a table cell.
 *
 * An <a> with padding is not a button in Outlook — the padding is dropped and
 * the background collapses to the text, which turns the one thing the
 * recipient is meant to press into an underlined word.
 */
function button(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0"><tr>`
    + `<td align="center" bgcolor="${ACCENT}" style="border-radius:9px;background:${ACCENT}">`
    + `<a href="${escapeHtml(url)}" target="_blank"`
    + ` style="display:inline-block;padding:12px 22px;font-family:${FONT};font-size:15px;`
    + `font-weight:600;line-height:1;color:${PAPER};text-decoration:none;border-radius:9px">`
    + `${escapeHtml(label)}</a></td></tr></table>`
}

/**
 * One message.
 *
 * The plain-text half is not a fallback nobody reads. A message with no text
 * part is scored as spam by most filters, and it is what a screen reader and
 * a watch notification actually use.
 */
export function renderEmail({ body, link, footerLink, postalAddress }: TemplateArgs): Rendered {
  const paragraphs = body
    .split('\n\n')
    .filter((p) => p.trim() !== '')
    .map((p) => `<p style="margin:0 0 15px;font-family:${FONT};font-size:15px;line-height:1.62;color:${SUB}">`
      + `${escapeHtml(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('')

  const cta = link ? button(link.url, link.label) : ''

  const address = postalAddress
    ? `<div style="margin-top:6px;font-family:${FONT};font-size:12px;line-height:1.5;color:${GHOST}">`
      + `${escapeHtml(postalAddress)}</div>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<!-- Tells clients the message has been designed for both, so iOS and Outlook
     stop inverting colours on their own and producing grey text on grey. -->
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Workmark</title>
</head>
<body style="margin:0;padding:0;background:${GROUND};-webkit-font-smoothing:antialiased">
${preheader(body)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${GROUND}" style="background:${GROUND}">
<tr><td align="center" style="padding:28px 16px 40px">

<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:100%">

  <!-- The sheet. One border, no shadow: a shadow is a box-shadow and Outlook
       does not have one, so the edge has to be the border. -->
  <tr><td bgcolor="${PAPER}" style="background:${PAPER};border:1px solid ${EDGE};border-radius:14px;padding:26px 30px 30px">
    ${wordmark()}
    <div style="height:1px;background:${HAIRLINE};margin:20px 0 22px;font-size:0;line-height:0">&nbsp;</div>
    ${paragraphs}
    ${cta}
  </td></tr>

  <!-- Outside the sheet, the way the app puts small print on the ground
       rather than in the card. -->
  <tr><td style="padding:18px 8px 0">
    <div style="font-family:${FONT};font-size:12px;line-height:1.5;color:${MUTED}">
      <a href="${escapeHtml(footerLink.url)}" style="color:${MUTED};text-decoration:underline">${escapeHtml(footerLink.label)}</a>
    </div>
    ${address}
  </td></tr>

</table>

</td></tr>
</table>
</body>
</html>`

  const text = [
    body.trim(),
    link ? `${link.label}: ${link.url}` : null,
    '—',
    `${footerLink.label}: ${footerLink.url}`,
    postalAddress ?? null,
  ].filter((part): part is string => part !== null).join('\n\n') + '\n'

  return { html, text }
}
