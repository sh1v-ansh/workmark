'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import SkillChip from '@/components/skills/SkillChip'
import { Icon } from '@/components/Icon'
import { useToast } from '@/components/Toast'
import { createClient } from '@/lib/supabase/client'
import { C, F, R, T } from '@/lib/theme/dark-tokens'
import type { PersonCard, InvitableProject } from '@/lib/listings/people'

/**
 * The People tab on Find work: students who chose to be found.
 *
 * It lived on its own page (/students) reached from the account menu, so
 * finding somebody to build with meant knowing the page existed. Here it sits
 * next to the projects, and each person has the one action the page exists
 * for: invite them to a project.
 */
export default function PeopleTab({
  people, invitable, viewerIsStudent, viewerId, openToCollab,
}: {
  people: PersonCard[]
  invitable: InvitableProject[]
  viewerIsStudent: boolean
  viewerId: string | null
  openToCollab: boolean
}) {
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [findable, setFindable] = useState(openToCollab)
  const [savingFindable, setSavingFindable] = useState(false)
  const [inviting, setInviting] = useState<PersonCard | null>(null)

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return people
    return people.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.line.toLowerCase().includes(q) ||
      p.topSkills.some((s) => s.name.toLowerCase().includes(q)))
  }, [people, query])

  async function toggleFindable() {
    if (!viewerId) return
    const next = !findable
    setSavingFindable(true)
    const { error } = await createClient().from('students').update({ open_to_collab: next }).eq('id', viewerId)
    setSavingFindable(false)
    if (error) {
      toast('Could not update that. Try again.', 'error')
      return
    }
    setFindable(next)
    toast(next ? 'Other students can now find you here.' : 'You are hidden from this list.', 'success')
  }

  return (
    <div>
      {viewerIsStudent && (
        <Card hoverable={false} padding="12px 16px" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <p style={{ fontSize: T.bodySm, color: C.textSub }}>
              <strong style={{ fontWeight: 600, color: C.text }}>
                {findable ? 'Other students can find you' : 'You are hidden from this list'}
              </strong>
              <span style={{ color: C.textMuted }}>
                {findable ? ' · your name, school and top skills show here' : ' · turn it on to get invited to projects'}
              </span>
            </p>
            <Button
              variant={findable ? 'outline' : 'accent'}
              size="sm"
              onClick={toggleFindable}
              busyLabel={savingFindable ? 'Saving…' : null}
            >
              {findable ? 'Hide me' : 'Let people find me'}
            </Button>
          </div>
        </Card>
      )}

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Icon name="search" size={15} style={{ position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)', color: C.textGhost, pointerEvents: 'none' }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, school, major or skill"
          className="dk-input"
          style={{ paddingLeft: 40 }}
          aria-label="Search people"
        />
      </div>

      {shown.length === 0 ? (
        <Card hoverable={false} padding={36}>
          <p style={{ fontSize: 15, color: C.textMuted, textAlign: 'center' }}>
            {people.length === 0 ? 'Nobody has chosen to be found yet.' : 'No one matches that search.'}
          </p>
        </Card>
      ) : (
        <div className="nb-g3">
          {shown.map((p) => (
            <Card key={p.id} hoverable={false} padding={18} style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
              <div>
                <p style={{ fontFamily: F.display, fontSize: 16, fontWeight: 600, letterSpacing: '-0.015em', color: C.text, marginBottom: 3 }}>
                  {p.handle
                    ? <Link href={`/p/${p.handle}`} style={{ color: C.text, textDecoration: 'none' }}>{p.name}</Link>
                    : p.name}
                </p>
                {p.line && <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.45 }}>{p.line}</p>}
                {p.availability && (
                  <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.textMuted, marginTop: 4 }}>
                    <Icon name="clock" size={12} />{p.availability}
                  </p>
                )}
              </div>

              {p.topSkills.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {p.topSkills.map((s) => <SkillChip key={s.name} name={s.name} level={s.level} size="sm" />)}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: C.textMuted }}>No verified skills yet.</p>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 'auto', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  {p.githubUrl && (
                    <a href={p.githubUrl} target="_blank" rel="noopener noreferrer" aria-label={`${p.name} on GitHub`} style={{ color: C.textMuted, display: 'inline-flex' }}>
                      <Icon name="github" size={15} />
                    </a>
                  )}
                  {p.linkedinUrl && (
                    <a href={p.linkedinUrl} target="_blank" rel="noopener noreferrer" aria-label={`${p.name} on LinkedIn`} style={{ color: C.textMuted, display: 'inline-flex' }}>
                      <Icon name="linkedin" size={15} />
                    </a>
                  )}
                </div>
                {viewerIsStudent && (
                  <Button variant="accent" size="sm" onClick={() => setInviting(p)}>Invite to a project</Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <InviteModal person={inviting} projects={invitable} onClose={() => setInviting(null)} />
    </div>
  )
}

/**
 * Invite somebody to a project you own, or name a new one and invite them
 * to it in the same step. Most people browsing here do not have the project
 * set up yet; making them leave, create it and come back would lose them.
 */
function InviteModal({ person, projects, onClose }: {
  person: PersonCard | null
  projects: InvitableProject[]
  onClose: () => void
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [choice, setChoice] = useState<string>('new')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [busy, setBusy] = useState(false)

  // Reset whenever a different person is picked.
  const [forId, setForId] = useState<string | null>(null)
  if (person && person.id !== forId) {
    setForId(person.id)
    setChoice(projects[0]?.id ?? 'new')
    setTitle('')
    setSummary('')
  }

  async function send() {
    if (!person) return
    if (choice === 'new' && title.trim().length < 3) {
      toast('Give the project a name first.', 'error')
      return
    }
    setBusy(true)
    try {
      let projectId = choice
      if (choice === 'new') {
        const res = await fetch('/api/workspaces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title.trim(), summary: summary.trim() || null }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Could not create the project.')
        projectId = json.id
      }
      const res = await fetch(`/api/workspaces/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: person.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not send the invite.')
      toast(`Invite sent to ${person.name}.`, 'success')
      onClose()
      router.refresh()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Could not send the invite.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const option = (key: string, label: string) => {
    const on = choice === key
    return (
      <button
        key={key}
        type="button"
        onClick={() => setChoice(key)}
        aria-pressed={on}
        style={{
          width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
          padding: '10px 12px', borderRadius: R.md, fontSize: 14, fontWeight: on ? 600 : 500,
          border: `1px solid ${on ? C.accent : C.border}`,
          background: on ? '#F4F1FF' : C.surface, color: on ? C.accent : C.text,
        }}
      >
        {label}
      </button>
    )
  }

  return (
    <Modal
      open={person !== null}
      onClose={onClose}
      title={person ? `Invite ${person.name}` : 'Invite'}
      subtitle="They get an invite and join once they accept."
    >
      <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
        {projects.map((p) => option(p.id, p.title))}
        {option('new', 'A new project')}
      </div>

      {choice === 'new' && (
        <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
          <input
            className="dk-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Project name"
            maxLength={120}
            aria-label="Project name"
          />
          <textarea
            className="dk-textarea"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="One or two lines on what you want to build together"
            rows={3}
            style={{ fontFamily: 'inherit', fontSize: 14 }}
            aria-label="What you want to build"
          />
        </div>
      )}

      <Button variant="accent" fullWidth onClick={send} busyLabel={busy ? 'Sending…' : null}>
        Send invite
      </Button>
    </Modal>
  )
}
