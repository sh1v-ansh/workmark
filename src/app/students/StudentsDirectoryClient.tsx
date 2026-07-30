'use client'

import { useMemo, useState } from 'react'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import { C, F } from '@/lib/theme/dark-tokens'
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

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <h1 style={{ fontFamily: F.serif, fontSize: 28, fontWeight: 700, color: C.text, marginBottom: 6, letterSpacing: '-0.02em' }}>
            Student directory
          </h1>
          <p style={{ fontSize: 13, color: C.textMuted, fontFamily: F.mono }}>
            Students who've opted in to being found for collaborations.
          </p>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: 13, color: C.textSub, marginBottom: 3 }}>List me in this directory</p>
            <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>Other students can find and message you to team up on a project.</p>
          </div>
          <button onClick={toggleOptIn} disabled={saving}
            style={{
              fontSize: 12, fontFamily: F.mono, padding: '8px 16px', cursor: saving ? 'not-allowed' : 'pointer',
              color: openToCollab ? '#FFFFFF' : C.textMuted,
              background: openToCollab ? C.accent : 'transparent',
              border: `1px solid ${openToCollab ? C.accent : C.border}`,
              opacity: saving ? 0.6 : 1,
            }}>
            {openToCollab ? '✓ Visible in directory' : 'Turn on'}
          </button>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, university, major, or skill…"
          className="dk-input"
          style={{ fontSize: 13 }}
        />

        {filtered.length === 0 ? (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 40, textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: C.textMuted }}>
              {directory.length === 0 ? 'No one has opted into the directory yet.' : 'No matches for that search.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((s) => (
              <div key={s.id} style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 500, color: C.textSub, marginBottom: 3 }}>{s.full_name ?? 'Student'}</p>
                    <p style={{ fontSize: 12, color: C.textFaint, fontFamily: F.mono }}>
                      {[s.degree_type, s.major, s.university].filter(Boolean).join(' · ')}
                      {s.graduation_year ? ` · Class of ${s.graduation_year}` : ''}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {s.github_url && (
                      <a href={s.github_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontFamily: F.mono, color: C.textMuted, textDecoration: 'none' }}>GitHub ↗</a>
                    )}
                    {s.linkedin_url && (
                      <a href={s.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontFamily: F.mono, color: C.textMuted, textDecoration: 'none' }}>LinkedIn ↗</a>
                    )}
                  </div>
                </div>
                {s.availability && (
                  <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono, marginBottom: s.skills && s.skills.length > 0 ? 8 : 0 }}>
                    Availability: {s.availability}
                  </p>
                )}
                {s.skills && s.skills.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {s.skills.map((sk) => (
                      <span key={sk} style={{ fontSize: 11, padding: '3px 8px', background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.textSub, fontFamily: F.mono }}>{sk}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
