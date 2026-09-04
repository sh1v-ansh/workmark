import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { TermlyEmbed } from '@/components/TermlyEmbed'
import { pastedHtmlFor } from '@/lib/legal/documents'
import { Wordmark } from '@/app/landing/Wordmark'
import { light as C, F, R } from '@/lib/theme/tokens'

/**
 * The legal documents, and where they come from.
 *
 * The text is hosted at Termly and pulled in at render time. The alternative
 * — pasting the text into this repo — sounds simpler and is worse: a policy
 * is a document that gets amended, and a copy in the codebase means the
 * published version is whatever happened to be deployed last. Here, amending
 * the document amends the page.
 *
 * The ids have to be inlined rather than looked up by slug, because Next
 * replaces `process.env.NEXT_PUBLIC_*` at build time by matching the literal
 * text — a dynamic key would compile to undefined in production.
 */
const DOCS = {
  privacy: {
    title: 'Privacy Policy',
    blurb: 'What we collect, why, who ever sees it, and how to get it deleted.',
    termlyId: process.env.NEXT_PUBLIC_TERMLY_PRIVACY_ID ?? '',
  },
  terms: {
    title: 'Terms of Service',
    blurb: 'The agreement between you and Workmark.',
    termlyId: process.env.NEXT_PUBLIC_TERMLY_TERMS_ID ?? '',
  },
  'acceptable-use': {
    title: 'Acceptable Use',
    blurb: 'What you may and may not do here — and what happens if you do.',
    termlyId: process.env.NEXT_PUBLIC_TERMLY_ACCEPTABLE_USE_ID ?? '',
  },
  cookies: {
    title: 'Cookie Policy',
    blurb: 'The one cookie we set, what it does, and how to get rid of it.',
    termlyId: process.env.NEXT_PUBLIC_TERMLY_COOKIES_ID ?? '',
  },
} as const

type Slug = keyof typeof DOCS

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }))
}

export async function generateMetadata(
  { params }: { params: { doc: string } },
): Promise<Metadata> {
  const doc = DOCS[params.doc as Slug]
  if (!doc) return {}
  return { title: `${doc.title} · Workmark`, description: doc.blurb }
}

export default function LegalPage({ params }: { params: { doc: string } }) {
  const doc = DOCS[params.doc as Slug]
  if (!doc) notFound()

  const pasted = pastedHtmlFor(params.doc)

  return (
    <main style={{ background: C.bg, minHeight: '100vh', color: C.text }}>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '36px 24px 72px' }}>
        <Link href="/" aria-label="Workmark home" style={{ display: 'inline-flex', textDecoration: 'none', marginBottom: 34 }}>
          <Wordmark height={22} />
        </Link>

        <h1 style={{ fontFamily: F.serif, fontSize: 32, fontWeight: 700, letterSpacing: '-0.025em', marginBottom: 8 }}>
          {doc.title}
        </h1>
        <p style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.6, marginBottom: 30 }}>{doc.blurb}</p>

        <nav aria-label="Legal documents" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 34 }}>
          {(Object.keys(DOCS) as Slug[]).map((slug) => (
            <Link
              key={slug}
              href={`/legal/${slug}`}
              className={slug === params.doc ? 'nb-tab nb-tab-active' : 'nb-tab'}
              aria-current={slug === params.doc ? 'page' : undefined}
            >
              {DOCS[slug].title}
            </Link>
          ))}
        </nav>

        {/* Three sources, in order of how current they stay. The live embed
            reflects whatever the document says today; pasted HTML reflects
            whatever it said when somebody pasted it; the placeholder is
            honest about there being nothing. */}
        {doc.termlyId ? (
          <TermlyEmbed dataId={doc.termlyId} />
        ) : pasted ? (
          // The content is a file in this repo, written by us — not user
          // input — so there is nothing here to sanitize against. Note that
          // any <script> in it will not run: that's how innerHTML works, and
          // it's why the embed is the better path for the cookie table.
          <div className="legal-prose" dangerouslySetInnerHTML={{ __html: pasted }} />
        ) : (
          // Shown when the embed id isn't configured — in local development,
          // or in a deploy where the env var was missed. Saying so plainly
          // beats an empty page that looks like the policy is blank.
          <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: R.md, padding: '20px 22px' }}>
            <p style={{ fontSize: 14.5, lineHeight: 1.65, color: C.textMuted, marginBottom: 10 }}>
              This document isn&apos;t published yet.
            </p>
            <p style={{ fontSize: 13.5, lineHeight: 1.65, color: C.textFaint }}>
              Ask us for the current text at{' '}
              <a href="mailto:support@workmark.org" style={{ color: C.text }}>support@workmark.org</a>{' '}
              and we&apos;ll send it. (Developers: set{' '}
              <code style={{ fontFamily: F.mono, fontSize: 12.5 }}>NEXT_PUBLIC_TERMLY_*_ID</code>.)
            </p>
          </div>
        )}

        <p style={{ fontSize: 12.5, color: C.textGhost, lineHeight: 1.6, marginTop: 40 }}>
          Questions about any of this go to{' '}
          <a href="mailto:support@workmark.org" style={{ color: C.textFaint }}>support@workmark.org</a>.
          If you want a copy of everything we hold about you, or want it deleted, ask there and
          we&apos;ll do it.
        </p>
      </div>
    </main>
  )
}
