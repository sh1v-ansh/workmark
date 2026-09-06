'use client'

import { useState } from 'react'
import { C, F } from './tokens'

/**
 * Who is building this.
 *
 * Names and faces, nothing else. The previous version carried a paragraph of
 * biography each, which on a pre-launch product is a paragraph about what
 * two people intend to do rather than what they have done — and a stranger
 * deciding whether to let us read their code is not helped by it. Two names
 * and two faces answer the only question being asked: is there a person
 * behind this.
 *
 * To add a photo, drop a file at the path below into /public/team/. Nothing
 * else to change — until then the initials show, which is a deliberate
 * fallback and not a placeholder anyone needs to remember to remove.
 */
const TEAM = [
  { name: 'Shivansh Soni', photo: '/team/shivansh-soni.jpg' },
  { name: 'Jineshwar Nariani', photo: '/team/jineshwar-nariani.jpg' },
]

function initials(name: string) {
  return name.trim().split(/\s+/).map((p) => p[0]).join('').toUpperCase().slice(0, 2)
}

function Portrait({ name, photo }: { name: string; photo: string }) {
  // A plain <img>, not next/image, precisely so a missing file is a load
  // error this component can catch rather than a build-time or server-side
  // failure. The photos are meant to be dropped in later.
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="wm-portrait wm-portrait-empty" aria-hidden="true">
        <span>{initials(name)}</span>
      </div>
    )
  }

  return (
    <img
      src={photo}
      alt={name}
      className="wm-portrait"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

export function TeamSection() {
  return (
    <section className="wm-section" style={{ position: 'relative' }}>
      <div className="wm-section-inner" style={{ textAlign: 'center' }}>
        <span className="wm-eyebrow-2">Who is building this</span>
        <h2 className="wm-h2" style={{ marginBottom: 42 }}>Two people, at UMass Amherst</h2>

        <div style={{ display: 'flex', gap: 44, justifyContent: 'center', flexWrap: 'wrap' }}>
          {TEAM.map((person) => (
            <div key={person.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 15 }}>
              <Portrait name={person.name} photo={person.photo} />
              <p style={{ fontFamily: F.sans, fontSize: 16.5, fontWeight: 600, color: C.text, letterSpacing: '-0.012em' }}>
                {person.name}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
