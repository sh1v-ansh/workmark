'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import AdminShell from '../AdminShell'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Drawer from '@/components/ui/Drawer'
import { Kicker } from '@/components/ui/Section'
import { useToast } from '@/components/Toast'
import { C, R, state } from '@/lib/theme/dark-tokens'
import type { QueueItem, QueueKind } from '@/lib/admin/queue'

const KIND_LABEL: Record<QueueKind, string> = {
  dispute: 'Disputes',
  review_request: 'Work to review',
  faculty_verification: 'Faculty to verify',
  unresolved_skill: 'Unmatched skills',
  failed_job: 'Failed scans',
}

/** Why each kind is here — shown once per group rather than on every row. */
const KIND_BLURB: Record<QueueKind, string> = {
  dispute: 'A student challenged something on their record. These have a 30-day legal deadline.',
  review_request: 'Work with no scannable repo, submitted for a person to confirm.',
  faculty_verification: 'Someone says they teach. Until confirmed, their attestations carry student weight.',
  unresolved_skill: 'Names the scanner couldn\'t place. Mapping one fixes it for every future scan.',
  failed_job: 'A scan that stopped. Retrying resumes from where it left off.',
}

const ORDER: QueueKind[] = ['dispute', 'review_request', 'faculty_verification', 'unresolved_skill', 'failed_job']

function relativeDays(iso: string): string {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return `${Math.floor(days / 30)} month${days < 60 ? '' : 's'} ago`
}

function dueLabel(item: QueueItem): string | null {
  if (!item.dueAt) return null
  const days = Math.ceil((Date.parse(item.dueAt) - Date.now()) / 86_400_000)
  if (days < 0) return `${Math.abs(days)} days overdue`
  if (days === 0) return 'due today'
  return `${days} days left`
}

export default function AdminQueueClient({ items, counts, failedSources, taxonomy }: {
  items: QueueItem[]
  counts: Record<QueueKind, number>
  failedSources: QueueKind[]
  taxonomy: { id: string; name: string }[]
}) {
  const router = useRouter()
  const { toast } = useToast()

  const [filter, setFilter] = useState<QueueKind | 'all'>('all')
  const [open, setOpen] = useState<QueueItem | null>(null)
  const [note, setNote] = useState('')
  const [skillQuery, setSkillQuery] = useState('')
  const [skillId, setSkillId] = useState('')
  const [busy, setBusy] = useState(false)

  const shown = filter === 'all' ? items : items.filter((i) => i.kind === filter)
  const overdue = items.filter((i) => i.severity === 'overdue').length

  const skillMatches = useMemo(() => {
    const q = skillQuery.trim().toLowerCase()
    if (!q) return []
    return taxonomy.filter((s) => s.name.toLowerCase().includes(q) || s.id.includes(q)).slice(0, 8)
  }, [skillQuery, taxonomy])

  function openItem(item: QueueItem) {
    setOpen(item)
    setNote('')
    setSkillQuery('')
    setSkillId('')
  }

  async function act(action: string, extra: Record<string, unknown> = {}) {
    if (!open) return
    setBusy(true)
    try {
      const res = await fetch('/api/admin/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: open.kind, id: open.id, action, note, ...extra }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not complete that.')
      toast(json.message, 'success')
      setOpen(null)
      router.refresh()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Could not complete that.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminShell
      title={items.length === 0 ? 'Nothing waiting' : `${items.length} waiting on a person`}
      lede={overdue > 0
        ? `${overdue} past its deadline. Disputes carry a 30-day legal clock — those come first.`
        : 'Sorted by deadline, then by how many people each affects.'}
      queueCount={items.length}
      overdueCount={overdue}
    >
        {/* A source that failed is called out rather than silently showing
            fewer items — an empty dispute list because the query broke looks
            exactly like an empty dispute list because there's nothing to do. */}
        {failedSources.length > 0 && (
          <div style={{ background: state.cautionBg, borderRadius: R.md, padding: '12px 16px', marginBottom: 20 }}>
            <p style={{ fontSize: 13.5, color: state.caution }}>
              Couldn&apos;t load: {failedSources.map((f) => KIND_LABEL[f]).join(', ')}. This list is incomplete.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 20 }}>
          <button
            onClick={() => setFilter('all')}
            className={`nb-tab${filter === 'all' ? ' nb-tab-active' : ''}`}
          >
            All · {items.length}
          </button>
          {ORDER.filter((k) => counts[k] > 0).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`nb-tab${filter === k ? ' nb-tab-active' : ''}`}
            >
              {KIND_LABEL[k]} · {counts[k]}
            </button>
          ))}
        </div>

        {filter !== 'all' && (
          <p style={{ fontSize: 13.5, color: C.textFaint, marginBottom: 14, lineHeight: 1.55, maxWidth: '62ch' }}>
            {KIND_BLURB[filter]}
          </p>
        )}

        {shown.length === 0 ? (
          <Card hoverable={false} padding={34}>
            <p style={{ fontSize: 15, color: C.textFaint, textAlign: 'center', lineHeight: 1.6 }}>
              Nothing here. Work submitted for review, disputes, unmatched skills and failed scans
              all land on this page.
            </p>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {shown.map((item) => {
              const due = dueLabel(item)
              return (
                <button
                  key={`${item.kind}:${item.id}`}
                  onClick={() => openItem(item)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', font: 'inherit', cursor: 'pointer',
                    background: C.surface,
                    // A severity stripe rather than a coloured row: the state
                    // reads at a glance without making overdue items harder
                    // to actually read.
                    borderLeft: `3px solid ${
                      item.severity === 'overdue' ? '#B91C1C'
                      : item.severity === 'due_soon' ? state.caution
                      : C.border
                    }`,
                    border: `1px solid ${C.border}`,
                    borderLeftWidth: 3,
                    borderLeftColor: item.severity === 'overdue' ? '#B91C1C'
                      : item.severity === 'due_soon' ? state.caution
                      : C.border,
                    borderRadius: R.md,
                    padding: '13px 16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap', marginBottom: 3 }}>
                    <Badge tone={item.kind === 'dispute' ? 'caution' : 'neutral'}>{KIND_LABEL[item.kind]}</Badge>
                    <span style={{ fontSize: 14.5, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.title}
                    </span>
                    {due && (
                      <span style={{
                        fontSize: 12, fontWeight: 700,
                        color: item.severity === 'overdue' ? '#B91C1C' : state.caution,
                      }}>
                        {due}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: C.textFaint, lineHeight: 1.5, margin: 0 }}>
                    {[item.subjectName, item.detail, relativeDays(item.createdAt)]
                      .filter(Boolean).join(' · ').slice(0, 180)}
                  </p>
                </button>
              )
            })}
          </div>
        )}
      <Drawer
        open={!!open}
        onClose={() => { if (!busy) setOpen(null) }}
        title={open ? KIND_LABEL[open.kind].replace(/s$/, '') : ''}
        subtitle={open?.title}
        footer={open ? <Actions item={open} act={act} busy={busy} skillId={skillId} note={note} /> : null}
      >
        {open && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {open.detail && (
              <div>
                <Kicker style={{ marginBottom: 6 }}>What they said</Kicker>
                <p style={{ fontSize: 14, color: C.textSub, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{open.detail}</p>
              </div>
            )}

            {open.subjectName && (
              <div>
                <Kicker style={{ marginBottom: 6 }}>Who</Kicker>
                <p style={{ fontSize: 14, color: C.textSub }}>{open.subjectName}</p>
              </div>
            )}

            {open.kind === 'unresolved_skill' && (
              <div>
                <Kicker style={{ marginBottom: 6 }}>Map it to</Kicker>
                <p style={{ fontSize: 13, color: C.textFaint, marginBottom: 9, lineHeight: 1.5 }}>
                  Every future scan that sees this name resolves it instantly. Existing records
                  aren&apos;t rewritten — they pick it up on their next scan.
                </p>
                <div style={{ position: 'relative' }}>
                  <input
                    value={skillId ? (taxonomy.find((s) => s.id === skillId)?.name ?? '') : skillQuery}
                    onChange={(e) => { setSkillQuery(e.target.value); setSkillId('') }}
                    className="dk-input"
                    placeholder="Search the taxonomy…"
                    aria-label="Skill to map to"
                  />
                  {!skillId && skillMatches.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: 4,
                      background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.md, overflow: 'hidden',
                    }}>
                      {skillMatches.map((s) => (
                        <button
                          key={s.id} type="button"
                          onClick={() => { setSkillId(s.id); setSkillQuery('') }}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left', padding: '9px 13px',
                            background: 'transparent', border: 'none', color: C.textSub, fontSize: 14,
                            cursor: 'pointer', font: 'inherit',
                          }}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {(open.kind === 'dispute' || open.kind === 'review_request') && (
              <div>
                <Kicker style={{ marginBottom: 6 }}>
                  {open.kind === 'dispute' ? 'Your decision (the student reads this)' : 'Note (optional)'}
                </Kicker>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  className="dk-textarea"
                  style={{ fontFamily: 'inherit', fontSize: 14.5, lineHeight: 1.6 }}
                  placeholder={open.kind === 'dispute'
                    ? 'What you found, and what happens to their record.'
                    : 'Anything worth recording.'}
                />
              </div>
            )}

            <p style={{ fontSize: 12.5, color: C.textGhost, lineHeight: 1.55 }}>
              This action and who took it are recorded against
              {open.subjectName ? ` ${open.subjectName}'s` : ' the'} record.
            </p>
          </div>
        )}
      </Drawer>
    </AdminShell>
  )
}

function Actions({ item, act, busy, skillId, note }: {
  item: QueueItem
  act: (action: string, extra?: Record<string, unknown>) => void
  busy: boolean
  skillId: string
  note: string
}) {
  const row = { display: 'flex', gap: 9, flexWrap: 'wrap' as const, alignItems: 'center' }

  switch (item.kind) {
    case 'review_request':
      return (
        <div style={row}>
          <Button variant="accent" onClick={() => act('approve')} disabled={busy}>Approve</Button>
          <Button variant="outline" onClick={() => act('reject')} disabled={busy}>Reject</Button>
        </div>
      )
    case 'dispute':
      return (
        <div style={row}>
          <Button variant="ink" onClick={() => act('resolved_verified')} disabled={busy || !note.trim()}>
            Record is correct
          </Button>
          <Button variant="outline" onClick={() => act('resolved_corrected')} disabled={busy || !note.trim()}>
            Corrected
          </Button>
          <Button variant="outline" onClick={() => act('resolved_retracted')} disabled={busy || !note.trim()}>
            Retract evidence
          </Button>
        </div>
      )
    case 'unresolved_skill':
      return (
        <div style={row}>
          <Button variant="accent" onClick={() => act('map', { skillId })} disabled={busy || !skillId}>
            Map it
          </Button>
          <Button variant="quiet" onClick={() => act('not_a_skill')} disabled={busy}>Not a skill</Button>
        </div>
      )
    case 'failed_job':
      return (
        <div style={row}>
          <Button variant="accent" onClick={() => act('retry')} disabled={busy}>Retry the scan</Button>
        </div>
      )
    case 'faculty_verification':
      return (
        <div style={row}>
          <Button variant="accent" onClick={() => act('approve')} disabled={busy}>Confirm faculty</Button>
          <Button variant="outline" onClick={() => act('decline')} disabled={busy}>Not faculty</Button>
        </div>
      )
  }
}
