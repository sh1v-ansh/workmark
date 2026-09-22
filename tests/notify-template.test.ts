import { describe, it, expect } from 'vitest'
import { renderEmail } from '../src/lib/notify/template'

const FOOTER = { url: 'https://www.workmark.org/unsub?t=x', label: 'Unsubscribe from these' }

function render(over: Partial<Parameters<typeof renderEmail>[0]> = {}) {
  return renderEmail({ body: 'First line.\n\nSecond line.', footerLink: FOOTER, ...over })
}

describe('renderEmail', () => {
  // The constraint the whole template exists to satisfy. A young sending
  // domain does not survive remote content, and every one of these would be
  // a request out of the recipient's mail client.
  it('loads nothing from anywhere', () => {
    const { html } = render({ link: { url: 'https://www.workmark.org/x', label: 'Open' } })
    expect(html).not.toMatch(/<img/i)
    expect(html).not.toMatch(/background-image|url\(/i)
    expect(html).not.toMatch(/<script|<iframe/i)
    expect(html).not.toMatch(/fonts\.googleapis|@import|<link/i)
  })

  it('keeps every paragraph', () => {
    const { html } = render()
    expect(html).toMatch(/First line\./)
    expect(html).toMatch(/Second line\./)
    expect(html.match(/<p style/g)?.length).toBe(2)
  })

  // A message with no text part is scored as spam by most filters, and it is
  // what a watch notification actually shows.
  it('writes a plain-text half that carries the same facts', () => {
    const { text } = render({ link: { url: 'https://www.workmark.org/x', label: 'Open it' } })
    expect(text).toMatch(/First line\./)
    expect(text).toMatch(/Open it: https:\/\/www\.workmark\.org\/x/)
    expect(text).toMatch(/Unsubscribe from these: /)
  })

  it('carries the unsubscribe link in the HTML too', () => {
    expect(render().html).toMatch(/https:\/\/www\.workmark\.org\/unsub\?t=x/)
  })

  // Names and project titles reach this from user input.
  it('escapes the body', () => {
    const { html } = render({ body: 'Hi <script>alert(1)</script> & "you"' })
    expect(html).not.toMatch(/<script>alert/)
    expect(html).toMatch(/&lt;script&gt;/)
    expect(html).toMatch(/&amp;/)
  })

  it('escapes the link and its label', () => {
    const { html } = render({ link: { url: 'https://x.test/?a=1&b=2', label: 'A & B' } })
    expect(html).toMatch(/a=1&amp;b=2/)
    expect(html).toMatch(/A &amp; B/)
  })

  // CAN-SPAM. Present when the caller supplies one, absent otherwise — the
  // template does not invent an address.
  it('prints the postal address when there is one', () => {
    expect(render({ postalAddress: '1 Campus Way, Amherst MA' }).html)
      .toMatch(/1 Campus Way, Amherst MA/)
    expect(render({ postalAddress: '1 Campus Way, Amherst MA' }).text)
      .toMatch(/1 Campus Way, Amherst MA/)
  })

  it('leaves it out when there is none', () => {
    expect(render({ postalAddress: null }).html).not.toMatch(/Campus Way/)
  })

  // Without one, Gmail previews the first text in the document — which in a
  // designed email is the word in the logo, so every message in the list
  // reads "Workmark Workmark Workmark".
  it('opens with a preheader taken from the body, not from the logo', () => {
    const { html } = render({ logoUrl: 'https://www.workmark.org/logo.png' })
    // The hidden preheader carries the body, and it has to come before the
    // sheet — anything earlier in the document is what the inbox previews.
    expect(html).toMatch(/mso-hide:all[^>]*>First line\./)
    expect(html.indexOf('First line.')).toBeLessThan(html.indexOf('alt="Workmark"'))
  })

  it('renders no call to action when there is no link', () => {
    expect(render({ link: null }).html).not.toMatch(/border-radius:9px/)
  })
})

describe('the logo', () => {
  const LOGO = 'https://www.workmark.org/workmark-logo-transparent.png'

  it('is the only thing loaded from anywhere', () => {
    const { html } = render({ logoUrl: LOGO })
    expect(html.match(/<img/g)?.length).toBe(1)
    expect(html).toMatch(/src="https:\/\/www\.workmark\.org\/workmark-logo/)
  })

  // Outlook on Windows blocks remote images by default, and so does Gmail
  // for a sender it has not seen before — which is everybody on a young
  // domain. The alt text is what they actually see, so it has to be the
  // wordmark rather than nothing.
  it('degrades to the word rather than to a broken-image icon', () => {
    const { html } = render({ logoUrl: LOGO })
    expect(html).toMatch(/alt="Workmark"/)
    // Styled, so blocked alt text renders in the right face and weight.
    expect(html).toMatch(/alt="Workmark"[^>]*font-weight:700/)
  })

  it('falls back to text when there is no logo to point at', () => {
    const { html } = render({ logoUrl: null })
    expect(html).not.toMatch(/<img/)
    expect(html).toMatch(/>Workmark</)
  })

  // A relative path has no origin to resolve against in a mail client, so it
  // is a broken image in every inbox.
  it('is given dimensions so the layout does not jump while it loads', () => {
    const { html } = render({ logoUrl: LOGO })
    expect(html).toMatch(/width="132"/)
    expect(html).toMatch(/height="27"/)
  })
})
