'use client'

import { useEffect, useRef, useState } from 'react'
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
  const img = useRef<HTMLImageElement>(null)

  // The page is rendered on the server, so a missing photo can fail to load
  // before React is listening — onError never fires and the browser's broken
  // image (the alt text in a circle) stays on screen. Checked once on mount.
  useEffect(() => {
    const el = img.current
    if (el && el.complete && el.naturalWidth === 0) setFailed(true)
  }, [])

  if (failed) {
    return (
      <div className="wm-portrait wm-portrait-empty" aria-hidden="true">
        <span>{initials(name)}</span>
      </div>
    )
  }

  return (
    <img
      ref={img}
      src={photo}
      alt={name}
      className="wm-portrait"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

export function TeamSection({ compact = false }: { compact?: boolean }) {
  return (
    <section className="wm-section" style={{ position: 'relative', ...(compact ? { paddingTop: 24 } : {}) }}>
      <div className="wm-section-inner" style={{ textAlign: 'center' }}>
        <span className="wm-eyebrow-2">The founders</span>
        <h2 className="wm-h2" style={{ marginBottom: 42 }}>Built by two students who needed it</h2>

        <div style={{ display: 'flex', gap: 44, justifyContent: 'center', flexWrap: 'wrap' }}>
          {TEAM.map((person) => (
            <div key={person.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 15 }}>
              <Portrait name={person.name} photo={person.photo} />
              <div>
                <p style={{ fontFamily: F.sans, fontSize: 16.5, fontWeight: 600, color: C.text, letterSpacing: '-0.012em' }}>
                  {person.name}
                </p>
                <p style={{ fontFamily: F.sans, fontSize: 14, color: C.textMuted, marginTop: 2 }}>Co-founder</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
