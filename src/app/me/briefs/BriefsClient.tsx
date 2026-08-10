'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Card from '@/components/Card'
import { Icon } from '@/components/Icon'
import { useToast } from '@/components/Toast'
import { createClient } from '@/lib/supabase/client'
import { C, F } from '@/lib/theme/dark-tokens'
import { tagColor } from '@/lib/theme/tagColors'

export interface BriefRow {
  id: string
  title: string
  body: string
  targetSkillId: string | null
  targetSkillName: string | null
  targetRole: string | null
  difficulty: number | null
  issuedAt: string
  completedAt: string | null
}

interface TaxonomyOption {
  id: string
  canonicalName: string
  alreadyEvidenced: boolean
}

const DIFFICULTY_LABEL: Record<number, string> = {
  1: 'A weekend', 2: 'A few days', 3: 'A week or two', 4: 'Several weeks', 5: 'A month+',
}

export default function BriefsClient({ studentName, briefs, taxonomy, agentsAvailable }: {
  studentName: string | null
  briefs: BriefRow[]
  taxonomy: TaxonomyOption[]
  agentsAvailable: boolean
}) {
  const router = useRouter()
  const { toast } = useToast()

  const [query, setQuery] = useState('')
  const [skillId, setSkillId] = useState('')
  const [skillName, setSkillName] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [generating, setGenerating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return taxonomy.filter((s) => s.canonicalName.toLowerCase().includes(q) || s.id.includes(q)).slice(0, 8)
  }, [query, taxonomy])

  const open = briefs.filter((b) => !b.completedAt)
  const done = briefs.filter((b) => b.completedAt)

  async function generate() {
    if (!skillId) {
      toast('Pick a skill to build toward.', 'error')
      return
    }
    setGenerating(true)
    try {
      const res = await fetch('/api/agents/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId, targetRole }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not generate.')
      toast('Project idea ready.', 'success')
      setSkillId(''); setSkillName(''); setQuery('')
      router.refresh()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Could not generate.', 'error')
    } finally {
      setGenerating(false)
    }
  }

  async function setCompleted(id: string, completed: boolean) {
    setBusyId(id)
    const supabase = createClient()
    const { error } = await supabase
      .from('project_briefs')
      .update({ completed_at: completed ? new Date().toISOString() : null })
      .eq('id', id)
    if (error) toast('Could not update.', 'error')
    else router.refresh()
    setBusyId(null)
  }

  async function remove(id: string) {
    if (!confirm('Delete this project idea?')) return
    setBusyId(id)
    const supabase = createClient()
    const { error } = await supabase.from('project_briefs').delete().eq('id', id)
    if (error) toast('Could not delete.', 'error')
    else { toast('Deleted.', 'success'); router.refresh() }
    setBusyId(null)
  }

  function BriefCard({ b }: { b: BriefRow }) {
    const c = b.targetSkillName ? tagColor(b.targetSkillName) : null
    return (
      <Card hoverable={false} padding={20}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 }}>{b.title}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {b.targetSkillName && c && (
                <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 999, background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontFamily: F.mono }}>
                  {b.targetSkillName}
                </span>
              )}
              <span style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>
                {[b.difficulty ? DIFFICULTY_LABEL[b.difficulty] : null, new Date(b.issuedAt).toLocaleDateString()].filter(Boolean).join(' · ')}
              </span>
            </div>
          </div>
        </div>

        <p style={{ fontSize: 13, color: C.textSub, lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 14 }}>{b.body}</p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setCompleted(b.id, !b.completedAt)} disabled={busyId === b.id} className="wm-btn wm-btn-secondary wm-btn-sm" style={{ display: 'inline-flex' }}>
            <Icon name="check" size={12} /> {b.completedAt ? 'Mark not built' : 'I built this'}
          </button>
          <button onClick={() => remove(b.id)} disabled={busyId === b.id} className="wm-btn wm-btn-secondary wm-btn-sm" style={{ display: 'inline-flex' }}>
            Delete
          </button>
          {b.completedAt && (
            <Link href="/student/github" className="wm-btn wm-btn-primary wm-btn-sm" style={{ display: 'inline-flex' }}>
              <Icon name="github" size={12} /> Link the repo
            </Link>
          )}
        </div>
      </Card>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <Navbar userName={studentName ?? undefined} />

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <Link href="/me" style={{ fontSize: 12, fontFamily: F.mono, color: C.textFaint, textDecoration: 'none' }}>
            ← Your record
          </Link>
          <h1 style={{ fontFamily: F.serif, fontSize: 26, fontWeight: 700, color: C.text, margin: '12px 0 6px' }}>
            Project ideas
          </h1>
          <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>
            Private to you — never posted, never shown to anyone. Build one, link the repo, and it becomes verified evidence the same way any other project does.
          </p>
        </div>

        {agentsAvailable ? (
          <Card hoverable={false} padding={24}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>Get an idea</h2>
            <p style={{ fontSize: 12, color: C.textFaint, marginBottom: 14, lineHeight: 1.5 }}>
              Pick a skill you want on your record. We&apos;ll suggest something concrete enough to actually finish.
            </p>

            <div style={{ position: 'relative', marginBottom: 12 }}>
              <input
                value={skillId ? skillName : query}
                onChange={(e) => { setQuery(e.target.value); setSkillId(''); setSkillName('') }}
                className="dk-input"
                placeholder="Search skills — e.g. Rust, Postgres, React"
                aria-label="Target skill"
              />
              {!skillId && matches.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: 4, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}>
                  {matches.map((s) => (
                    <button
                      key={s.id} type="button"
                      onClick={() => { setSkillId(s.id); setSkillName(s.canonicalName); setQuery('') }}
                      style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '9px 14px', background: 'transparent', border: 'none', color: C.textSub, fontSize: 13, fontFamily: F.mono, cursor: 'pointer', textAlign: 'left' }}
                    >
                      {s.canonicalName}
                      {s.alreadyEvidenced && <span style={{ fontSize: 10, color: C.textFaint }}>already evidenced</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <input
              value={targetRole} onChange={(e) => setTargetRole(e.target.value)}
              className="dk-input" style={{ marginBottom: 12 }}
              placeholder="Roles you're aiming for (optional) — e.g. backend infrastructure"
              aria-label="Target role"
            />

            <button onClick={generate} disabled={generating || !skillId} className="wm-btn wm-btn-primary wm-btn-sm" style={{ display: 'inline-flex' }}>
              {generating ? 'Thinking…' : 'Suggest a project'}
            </button>
          </Card>
        ) : (
          <Card hoverable={false} padding={20}>
            <p style={{ fontSize: 13, color: C.textFaint }}>Project suggestions aren&apos;t configured on this deployment.</p>
          </Card>
        )}

        {open.length > 0 && (
          <section>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>To build ({open.length})</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {open.map((b) => <BriefCard key={b.id} b={b} />)}
            </div>
          </section>
        )}

        {done.length > 0 && (
          <section>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>Built ({done.length})</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {done.map((b) => <BriefCard key={b.id} b={b} />)}
            </div>
          </section>
        )}

        {briefs.length === 0 && (
          <Card hoverable={false} padding={28}>
            <p style={{ fontSize: 13, color: C.textFaint, textAlign: 'center', lineHeight: 1.6 }}>
              No project ideas yet. If your record is thin, this is the fastest way to fix it — the projects here are sized to actually finish.
            </p>
          </Card>
        )}
      </main>
    </div>
  )
}
