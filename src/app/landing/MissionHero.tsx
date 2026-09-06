'use client'

import Link from 'next/link'
import { Aurora } from './Aurora'
import { C, F } from './tokens'

/**
 * The hero.
 *
 * The old one led with "Building the largest database of verified work
 * records to fix hiring", which is a line written for an investor. No
 * student wants to join a database. It also sat under a dotted
 * "constellation" graphic that illustrated a network nobody had mentioned.
 *
 * This says what a student gets, in the order they care about: proof, then
 * work, then help when there is none. The promise underneath is the one
 * sentence the whole product is: do real work, build evidence of it, and
 * let the evidence open the door.
 */

const PROOF = [
  ['Free while you are a student', 'A .edu address is all it takes.'],
  ['You choose what we read', 'Repository by repository, revocable at any time.'],
  ['Your record, exportable', 'One file, whenever you want it, no asking.'],
]

export function MissionHero() {
  return (
    <section style={{ position: 'relative', padding: '150px 24px 92px', overflow: 'hidden' }}>
      <Aurora height={860} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 860, margin: '0 auto', textAlign: 'center' }}>
        <span
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 26,
            padding: '6px 14px 6px 8px', borderRadius: 999,
            background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(62,31,255,0.16)',
            backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            fontSize: 13, color: C.textMuted, fontFamily: F.sans,
          }}
        >
          <span style={{ padding: '3px 9px', borderRadius: 999, background: 'rgba(62,31,255,0.10)', color: C.accent, fontSize: 12, fontWeight: 700 }}>
            For CS students
          </span>
          Built at UMass Amherst
        </span>

        <h1
          className="mob-text-hero"
          style={{
            fontFamily: F.serif, fontSize: 62, fontWeight: 600, lineHeight: 1.06,
            letterSpacing: '-0.028em', color: C.text, margin: '0 0 24px', textWrap: 'balance',
          }}
        >
          Don&rsquo;t just tell people what you can do.{' '}
          <span style={{
            background: 'linear-gradient(103deg, #3E1FFF 0%, #7F5CFF 42%, #EC4899 100%)',
            WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
          }}>
            Prove it.
          </span>
        </h1>

        <p style={{ fontFamily: F.sans, fontSize: 19, lineHeight: 1.6, color: C.textMuted, maxWidth: 640, margin: '0 auto 34px', textWrap: 'pretty' }}>
          Workmark turns the code you have already written into a record employers can check —
          then finds you real project work that uses it. When nothing open fits, it writes you
          something worth building.
        </p>

        <div style={{ display: 'flex', gap: 11, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
          <Link href="/login" className="wm-cta-primary">Build my record</Link>
          <Link href="/listings" className="wm-cta-ghost">See open projects</Link>
        </div>

        <p style={{ fontFamily: F.sans, fontSize: 13, color: C.textFaint, marginBottom: 52 }}>
          Takes about two minutes. No CV, no cover letter.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 18, textAlign: 'left' }} className="mob-1col">
          {PROOF.map(([title, detail]) => (
            <div
              key={title}
              style={{
                padding: '15px 17px', borderRadius: 14,
                background: 'rgba(255,255,255,0.62)',
                border: '1px solid rgba(255,255,255,0.9)',
                backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                boxShadow: '0 1px 2px rgba(25,30,46,0.03), 0 14px 34px -22px rgba(25,30,46,0.30)',
              }}
            >
              <p style={{ fontFamily: F.sans, fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 3 }}>{title}</p>
              <p style={{ fontFamily: F.sans, fontSize: 13, color: C.textFaint, lineHeight: 1.5 }}>{detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
