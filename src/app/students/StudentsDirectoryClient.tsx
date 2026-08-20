'use client'

import Link from 'next/link'

import { useMemo, useState } from 'react'
import Navbar from '@/components/Navbar'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import { Icon } from '@/components/Icon'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import { C, F, R } from '@/lib/theme/dark-tokens'
import { tagColor } from '@/lib/theme/tagColors'
import type { Student } from '@/lib/types'

type DirectoryEntry = Pick<Student, 'id' | 'full_name' | 'university' | 'major' | 'degree_type' | 'graduation_year' | 'skills' | 'availability' | 'github_url' | 'linkedin_url' | 'handle'>

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

      <main id="main-content" style={{ maxWidth: 1180, margin: '0 auto', padding: '30px 28px 72px' }}>

        <div style={{ marginBottom: 22 }}>
          <h1 style={{ fontFamily: F.display, fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em', color: C.text, marginBottom: 8 }}>
            Student directory
          </h1>
          <p style={{ fontSize: 16, color: C.textMuted }}>
            Students who&apos;ve opted in to being found for collaborations.
          </p>
        </div>

        <Card hoverable={false} padding="16px 20px" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: R.md, background: openToCollab ? '#EDE9FF' : C.surfaceAlt, color: openToCollab ? C.accent : C.textFaint, flexShrink: 0 }}>
              <Icon name="users" size={18} />
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 3 }}>List me in this directory</p>
              <p style={{ fontSize: 13.5, color: C.textFaint }}>Other students can find and message you to team up on a project.</p>
            </div>
          </div>
          <Button variant={openToCollab ? 'ink' : 'outline'} size="sm" onClick={toggleOptIn} disabled={saving}>
            {openToCollab ? 'Visible' : 'Turn on'}
          </Button>
        </Card>

        <div style={{ position: 'relative', marginBottom: 20 }}>
          <Icon name="search" size={15} style={{ position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)', color: C.textGhost, pointerEvents: 'none' }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, university, major, or skill…"
            className="dk-input"
            style={{ paddingLeft: 40 }}
          />
        </div>

        {filtered.length === 0 ? (
          <Card hoverable={false} padding={44}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 46, height: 46, borderRadius: R.md, background: '#EDE9FF', color: C.accent, marginBottom: 16 }}>
                <Icon name="inbox" size={20} />
              </div>
              <p style={{ fontSize: 15.5, color: C.textMuted }}>
                {directory.length === 0 ? 'No one has opted into the directory yet.' : 'No matches for that search.'}
              </p>
            </div>
          </Card>
        ) : (
          <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {filtered.map((s) => (
              <Card key={s.id} hoverable={false} padding={20} style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: 11 }}>
                  <p style={{ fontFamily: F.display, fontSize: 17, fontWeight: 700, letterSpacing: '-0.015em', color: C.text, marginBottom: 4 }}>
                    {s.handle ? (
                      <Link href={`/p/${s.handle}`} style={{ color: C.text, textDecoration: 'none' }}>
                        {s.full_name ?? 'Student'} <span style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 600, color: C.accent }}>· verified record →</span>
                      </Link>
                    ) : (
                      s.full_name ?? 'Student'
                    )}
                  </p>
                  <p style={{ fontSize: 13.5, color: C.textFaint }}>
                    {[s.degree_type, s.major, s.university].filter(Boolean).join(' · ')}
                    {s.graduation_year ? ` · Class of ${s.graduation_year}` : ''}
                  </p>
                </div>

                {s.availability && (
                  <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, color: C.textFaint, marginBottom: s.skills && s.skills.length > 0 ? 11 : 0 }}>
                    <Icon name="clock" size={12} />{s.availability}
                  </p>
                )}

                {s.skills && s.skills.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', alignContent: 'flex-start', gap: 6, marginBottom: 13, flex: 1 }}>
                    {s.skills.slice(0, 5).map((sk) => {
                      const c = tagColor(sk)
                      return (
                        <span key={sk} style={{ fontSize: 12.5, fontWeight: 500, padding: '4px 10px', borderRadius: R.pill, background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
                          {sk}
                        </span>
                      )
                    })}
                  </div>
                )}

                {(s.github_url || s.linkedin_url) && (
                  <div style={{ display: 'flex', gap: 16, marginTop: 'auto', paddingTop: 11, borderTop: `1px solid ${C.borderFaint}` }}>
                    {s.github_url && (
                      <a href={s.github_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, color: C.textMuted, textDecoration: 'none' }}>
                        <Icon name="github" size={13} />GitHub
                      </a>
                    )}
                    {s.linkedin_url && (
                      <a href={s.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, color: C.textMuted, textDecoration: 'none' }}>
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
