'use client'

import { useMemo, useState } from 'react'
import Navbar from '@/components/Navbar'
import Card from '@/components/Card'
import { Icon } from '@/components/Icon'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import { C, F } from '@/lib/theme/dark-tokens'
import { tagColor } from '@/lib/theme/tagColors'
import type { Student } from '@/lib/types'

type DirectoryEntry = Pick<Student, 'id' | 'full_name' | 'university' | 'major' | 'degree_type' | 'graduation_year' | 'skills' | 'availability' | 'github_url' | 'linkedin_url'>

export default function StudentsDirectoryClient({ student, directory }: { student: Student; directory: DirectoryEntry[] }) {
  const { toast } = useToast()
  const [openToCollab, setOpenToCollab] = useState(student.open_to_collab)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')

  async function toggleOptIn() {
    const next = !openToCollab
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('students').update({ open_to_collab: next }).eq('id', student.id)
    setSaving(false)
    if (error) {
      toast(error.message, 'error')
      return
    }
    setOpenToCollab(next)
    toast(next ? "You're now listed in the student directory." : 'Removed from the student directory.', 'success')
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return directory
    return directory.filter((s) =>
      s.full_name?.toLowerCase().includes(q) ||
      s.university?.toLowerCase().includes(q) ||
      s.major?.toLowerCase().includes(q) ||
      s.skills?.some((sk) => sk.toLowerCase().includes(q))
    )
  }, [directory, query])

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <Navbar role="student" userName={student.full_name ?? undefined} />

      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <h1 style={{ fontFamily: F.serif, fontSize: 30, fontWeight: 700, color: C.text, marginBottom: 6, letterSpacing: '-0.02em' }}>
            Student directory
          </h1>
          <p style={{ fontSize: 13, color: C.textMuted }}>
            Students who've opted in to being found for collaborations.
          </p>
        </div>

        <Card hoverable={false} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: '50%', background: openToCollab ? C.accentHover : C.surfaceAlt, color: openToCollab ? C.accent : C.textFaint, flexShrink: 0 }}>
              <Icon name="users" size={18} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 3 }}>List me in this directory</p>
              <p style={{ fontSize: 12, color: C.textFaint }}>Other students can find and message you to team up on a project.</p>
            </div>
          </div>
          <button onClick={toggleOptIn} disabled={saving} className={openToCollab ? 'wm-btn wm-btn-primary wm-btn-sm' : 'wm-btn wm-btn-secondary wm-btn-sm'} style={{ display: 'inline-flex', opacity: saving ? 0.6 : 1 }}>
            {openToCollab ? <><Icon name="check" size={13} /> Visible</> : 'Turn on'}
          </button>
        </Card>

        <div style={{ position: 'relative' }}>
          <Icon name="search" size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.textGhost, pointerEvents: 'none' }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, university, major, or skill…"
            className="dk-input"
            style={{ fontSize: 13, paddingLeft: 38 }}
          />
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '72px 24px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 14 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: '50%', background: C.accentHover, color: C.accent, marginBottom: 14 }}>
              <Icon name="inbox" size={20} />
            </div>
            <p style={{ fontSize: 14, color: C.textMuted }}>
              {directory.length === 0 ? 'No one has opted into the directory yet.' : 'No matches for that search.'}
            </p>
          </div>
        ) : (
          <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {filtered.map((s) => (
              <Card key={s.id} hoverable={false} style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 }}>{s.full_name ?? 'Student'}</p>
                  <p style={{ fontSize: 12, color: C.textFaint }}>
                    {[s.degree_type, s.major, s.university].filter(Boolean).join(' · ')}
                    {s.graduation_year ? ` · Class of ${s.graduation_year}` : ''}
                  </p>
                </div>

                {s.availability && (
                  <p style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.textFaint, marginBottom: s.skills && s.skills.length > 0 ? 10 : 0 }}>
                    <Icon name="clock" size={12} />{s.availability}
                  </p>
                )}

                {s.skills && s.skills.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12, flex: 1 }}>
                    {s.skills.slice(0, 5).map((sk) => {
                      const c = tagColor(sk)
                      return (
                        <span key={sk} style={{ fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 999, background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontFamily: F.mono }}>
                          {sk}
                        </span>
                      )
                    })}
                  </div>
                )}

                {(s.github_url || s.linkedin_url) && (
                  <div style={{ display: 'flex', gap: 14, marginTop: 'auto', paddingTop: 10, borderTop: `1px solid ${C.borderFaint}` }}>
                    {s.github_url && (
                      <a href={s.github_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.textMuted, textDecoration: 'none' }}>
                        <Icon name="github" size={13} />GitHub
                      </a>
                    )}
                    {s.linkedin_url && (
                      <a href={s.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.textMuted, textDecoration: 'none' }}>
                        <Icon name="linkedin" size={13} />LinkedIn
                      </a>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
