'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import { Kicker } from '@/components/ui/Section'
import { useToast } from '@/components/Toast'
import { createClient } from '@/lib/supabase/client'
import { C, F, R } from '@/lib/theme/dark-tokens'
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
      <Card hoverable={false} padding={22}>
        <div style={{ marginBottom: 11 }}>
          <p style={{ fontFamily: F.display, fontSize: 17, fontWeight: 700, letterSpacing: '-0.015em', color: C.text, marginBottom: 6 }}>{b.title}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
            {b.targetSkillName && c && (
              <span style={{ fontSize: 12.5, padding: '3px 10px', borderRadius: R.pill, background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
                {b.targetSkillName}
              </span>
            )}
            <span style={{ fontSize: 13, color: C.textGhost }}>
              {[b.difficulty ? DIFFICULTY_LABEL[b.difficulty] : null, new Date(b.issuedAt).toLocaleDateString()].filter(Boolean).join(' · ')}
            </span>
          </div>
        </div>

        <p style={{ fontSize: 15, color: C.textSub, lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 16 }}>{b.body}</p>

        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          <Button variant="outline" size="sm" onClick={() => setCompleted(b.id, !b.completedAt)} disabled={busyId === b.id}>
            {b.completedAt ? 'Mark not built' : 'I built this'}
          </Button>
          <Button variant="quiet" size="sm" onClick={() => remove(b.id)} disabled={busyId === b.id}>Delete</Button>
          {b.completedAt && <Button href="/student/github" variant="ink" size="sm">Link the repo</Button>}
        </div>
      </Card>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <Navbar userName={studentName ?? undefined} />

      <main id="main-content" style={{ maxWidth: 680, margin: '0 auto', padding: '30px 28px 72px' }}>
        <Link href="/me" style={{ fontSize: 15, color: C.textFaint, textDecoration: 'none' }}>← Your record</Link>

        <div style={{ margin: '14px 0 24px' }}>
          <h1 style={{ fontFamily: F.display, fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: C.text, marginBottom: 8 }}>
            Project ideas
          </h1>
          <p style={{ fontSize: 15.5, color: C.textMuted, lineHeight: 1.6 }}>
            Private to you — never posted, never shown to anyone. Build one, link the repo, and it becomes verified evidence the same way any other project does.
          </p>
        </div>

        {agentsAvailable ? (
          <div className="nb-focal" style={{ padding: 24, marginBottom: 26 }}>
            <Kicker style={{ color: C.accentInk, marginBottom: 9 }}>Get an idea</Kicker>
            <p style={{ fontSize: 14.5, color: C.textMuted, marginBottom: 16, lineHeight: 1.5 }}>
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
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: 4, background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.md, overflow: 'hidden', boxShadow: '0 4px 6px rgba(25,30,46,0.04), 0 12px 32px rgba(25,30,46,0.10)' }}>
                  {matches.map((s) => (
                    <button
                      key={s.id} type="button"
                      onClick={() => { setSkillId(s.id); setSkillName(s.canonicalName); setQuery('') }}
                      style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 15px', background: 'transparent', border: 'none', color: C.textSub, fontSize: 15, cursor: 'pointer', textAlign: 'left', font: 'inherit' }}
                    >
                      {s.canonicalName}
                      {s.alreadyEvidenced && <span style={{ fontSize: 12.5, color: C.textGhost }}>already evidenced</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <input
              value={targetRole} onChange={(e) => setTargetRole(e.target.value)}
              className="dk-input" style={{ marginBottom: 14 }}
              placeholder="Roles you're aiming for (optional) — e.g. backend infrastructure"
              aria-label="Target role"
            />

            <Button variant="accent" onClick={generate} disabled={!skillId} busyLabel={generating ? 'Thinking…' : null}>
              Suggest a project
            </Button>
          </div>
        ) : (
          <Card hoverable={false} padding={22} style={{ marginBottom: 26 }}>
            <p style={{ fontSize: 15, color: C.textFaint }}>Project suggestions aren&apos;t configured on this deployment.</p>
          </Card>
        )}

        {open.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <Kicker style={{ marginBottom: 13 }}>To build · {open.length}</Kicker>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {open.map((b) => <BriefCard key={b.id} b={b} />)}
            </div>
          </div>
        )}

        {done.length > 0 && (
          <div>
            <Kicker style={{ marginBottom: 13 }}>Built · {done.length}</Kicker>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {done.map((b) => <BriefCard key={b.id} b={b} />)}
            </div>
          </div>
        )}

        {briefs.length === 0 && (
          <Card hoverable={false} padding={30}>
            <p style={{ fontSize: 15, color: C.textFaint, textAlign: 'center', lineHeight: 1.6 }}>
              No project ideas yet. If your record is thin, this is the fastest way to fix it — the projects here are sized to actually finish.
            </p>
          </Card>
        )}
      </main>
    </div>
  )
}
