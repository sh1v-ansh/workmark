'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import { Kicker } from '@/components/ui/Section'
import { useToast } from '@/components/Toast'
import SkillPicker, { type TaxonomySkill, type PickedRequirement } from '@/components/SkillPicker'
import { C, F, R, state } from '@/lib/theme/dark-tokens'
import { LISTING_KINDS } from '@/lib/listings/kinds'

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.textSub, marginBottom: 6.5 }}>
      {children}
    </label>
  )
}

/** A listing as the form holds it — every number as the text in its box. */
export interface ListingDraft {
  kind: string
  /** The poster's two application questions; blank means the standard pair. */
  questions?: { prompt: string; kind: string; hint: string }[]
  title: string
  brief: string
  requirements: PickedRequirement[]
  hoursPerWeek: string
  estHours: string
  duration: string
  workMode: string
  teamSize: string
  difficulty: string
}

/**
 * Posting and editing are the same form. With `editing` it starts filled
 * in, saves with PATCH, and drops the draft-from-a-description box — that
 * would overwrite what the poster already wrote.
 */
export default function NewListingClient({ taxonomy, agentsAvailable, editing }: {
  taxonomy: TaxonomySkill[]
  agentsAvailable: boolean
  editing?: { id: string; initial: ListingDraft }
}) {
  const init = editing?.initial
  const router = useRouter()
  const { toast } = useToast()

  const [kind, setKind] = useState(init?.kind ?? '')
  const [questions, setQuestions] = useState<{ prompt: string; kind: string; hint: string }[]>(
    init?.questions?.length ? init.questions : [{ prompt: '', kind: 'custom', hint: '' }, { prompt: '', kind: 'custom', hint: '' }],
  )
  const [suggesting, setSuggesting] = useState(false)

  // Only when asked. The suggestions land in the boxes to keep or rewrite.
  async function suggestQuestions() {
    setSuggesting(true)
    try {
      const res = await fetch('/api/agents/application-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, brief, skills: requirements.map((r) => r.canonicalName) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not suggest questions.')
      setQuestions((json.questions as { prompt: string; kind: string; hint: string }[]).map((q) => ({ prompt: q.prompt, kind: q.kind, hint: q.hint })))
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Could not suggest questions.', 'error')
    } finally {
      setSuggesting(false)
    }
  }
  const [title, setTitle] = useState(init?.title ?? '')
  const [brief, setBrief] = useState(init?.brief ?? '')
  const [requirements, setRequirements] = useState<PickedRequirement[]>(init?.requirements ?? [])
  const [hoursPerWeek, setHoursPerWeek] = useState(init?.hoursPerWeek ?? '')
  const [estHours, setEstHours] = useState(init?.estHours ?? '')
  const [duration, setDuration] = useState(init?.duration ?? '')
  const [workMode, setWorkMode] = useState(init?.workMode ?? 'remote')
  const [teamSize, setTeamSize] = useState(init?.teamSize ?? '')
  const [difficulty, setDifficulty] = useState(init?.difficulty ?? '')
  const [saving, setSaving] = useState(false)
  const [rough, setRough] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [unrecognized, setUnrecognized] = useState<string[]>([])

  // Fills the form and stops. Nothing is saved until the poster reviews
  // it and submits — the agent proposes, the poster decides (§2).
  async function draftFromDescription() {
    setDrafting(true)
    try {
      const res = await fetch('/api/agents/listing-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: rough }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not draft.')
      const d = json.draft as {
        title: string
        brief: string
        requirements: { skillId: string; canonicalName: string; requiredLevel: number }[]
        unrecognizedSkills: string[]
      }
      setTitle(d.title)
      setBrief(d.brief)
      setRequirements(d.requirements.map((r) => ({ skillId: r.skillId, canonicalName: r.canonicalName, requiredLevel: r.requiredLevel })))
      setUnrecognized(d.unrecognizedSkills ?? [])
      toast('Draft ready — edit anything that is off, then post.', 'success')
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Could not draft.', 'error')
    } finally {
      setDrafting(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!kind) {
      toast('Choose what kind of posting this is.', 'error')
      return
    }
    if (requirements.length === 0) {
      toast('Add at least one required skill so applicants can be matched.', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(editing ? `/api/listings/${editing.id}` : '/api/listings', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          title,
          brief,
          est_hours: estHours ? parseInt(estHours) : null,
          hours_per_week: hoursPerWeek ? parseInt(hoursPerWeek) : null,
          duration: duration || null,
          work_mode: workMode || null,
          team_size: teamSize ? parseInt(teamSize) : null,
          declared_difficulty: difficulty ? parseInt(difficulty) : null,
          requirements: requirements.map((r) => ({ skillId: r.skillId, requiredLevel: r.requiredLevel })),
          application_questions: questions.filter((q) => q.prompt.trim()),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? (editing ? 'Could not save your changes.' : 'Could not create the listing.'))
      toast(editing ? 'Changes saved.' : 'Project posted.', 'success')
      router.push(`/listings/${editing?.id ?? json.id}`)
      router.refresh()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Something went wrong.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const gap: React.CSSProperties = { display: 'flex', flexDirection: 'column' }

  return (
    <div className="wm-app-ground" style={{ minHeight: '100vh', background: C.bg }}>

      <main id="main-content" style={{ maxWidth: 680, margin: '0 auto', padding: '30px 28px 72px' }}>
        <h1 style={{ fontFamily: F.display, fontSize: 24, fontWeight: 600, letterSpacing: '-0.022em', color: C.text, marginBottom: 7 }}>
          {editing ? 'Edit project' : 'Post a project'}
        </h1>
        <p style={{ fontSize: 15, color: C.textMuted, marginBottom: 23 }}>
          {editing
            ? 'Anyone who already applied keeps the questions they answered.'
            : 'Applicants are matched on whether their linked repos actually demonstrate the skills you list.'}
        </p>

        {agentsAvailable && !editing && (
          <div className="nb-focal" style={{ padding: 21, marginBottom: 20 }}>
            <Kicker style={{ color: C.accentInk, marginBottom: 8.5 }}>Start from a description</Kicker>
            <p style={{ fontSize: 13.5, color: C.textMuted, marginBottom: 13, lineHeight: 1.5 }}>
              Describe the project in your own words and we&apos;ll fill in the form below. Everything stays editable — nothing is posted until you say so.
            </p>
            <textarea
              value={rough} onChange={(e) => setRough(e.target.value)} rows={3}
              className="dk-textarea" style={{ fontFamily: 'inherit', fontSize: 14, marginBottom: 11.5 }}
              placeholder="I'm building a tool that pulls my bank transactions and categorizes them. I've done the backend but I need someone for the frontend."
              aria-label="Rough project description"
            />
            <Button type="button" variant="outline" size="sm" onClick={draftFromDescription} disabled={rough.trim().length < 20} busyLabel={drafting ? 'Drafting…' : null}>
              Draft it for me
            </Button>
            {unrecognized.length > 0 && (
              <p style={{ fontSize: 13, color: state.caution, marginTop: 11, lineHeight: 1.5 }}>
                Skipped {unrecognized.length} suggested skill{unrecognized.length === 1 ? '' : 's'} we don&apos;t track yet ({unrecognized.join(', ')}). Add the closest match by hand if it matters.
              </p>
            )}
          </div>
        )}

        <Card hoverable={false} padding={25}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* First, because it decides who should be reading the rest. */}
            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.textSub, marginBottom: 8 }}>
                What kind of posting is this? <span aria-hidden="true" style={{ color: C.accent }}>*</span><span className="sr-only"> (required)</span>
              </legend>
              <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {LISTING_KINDS.map((k) => {
                  const on = kind === k.key
                  return (
                    <button
                      key={k.key}
                      type="button"
                      onClick={() => setKind(k.key)}
                      aria-pressed={on}
                      style={{
                        textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                        padding: '11px 13px', borderRadius: R.md,
                        border: `1px solid ${on ? C.accent : C.border}`,
                        background: on ? '#F4F1FF' : C.surface,
                        boxShadow: on ? '0 0 0 3px rgba(97,66,245,0.12)' : 'none',
                      }}
                    >
                      <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: on ? C.accent : C.text }}>{k.label}</span>
                      <span style={{ display: 'block', fontSize: 13, color: C.textMuted, marginTop: 2 }}>{k.hint}</span>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <div style={gap}>
              <FieldLabel htmlFor="listing-title">Title <span aria-hidden="true" style={{ color: C.accent }}>*</span><span className="sr-only"> (required)</span></FieldLabel>
              <input id="listing-title" required value={title} onChange={(e) => setTitle(e.target.value)} className="dk-input" placeholder="Build a real-time collaboration backend" />
            </div>

            <div style={gap}>
              <FieldLabel htmlFor="listing-brief">What needs building <span aria-hidden="true" style={{ color: C.accent }}>*</span><span className="sr-only"> (required)</span></FieldLabel>
              <textarea
                id="listing-brief" required value={brief} onChange={(e) => setBrief(e.target.value)}
                rows={6} className="dk-textarea" style={{ fontFamily: 'inherit', fontSize: 16, lineHeight: 1.65 }}
                placeholder="What the project is, what the collaborator would own, and what done looks like."
              />
            </div>

            <div>
              <FieldLabel htmlFor="listing-skills">Required skills <span aria-hidden="true" style={{ color: C.accent }}>*</span><span className="sr-only"> (required)</span></FieldLabel>
              <SkillPicker taxonomy={taxonomy} value={requirements} onChange={setRequirements} />
            </div>

            <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={gap}>
                <FieldLabel htmlFor="listing-hpw">Hours per week</FieldLabel>
                <input id="listing-hpw" type="number" min={1} max={60} value={hoursPerWeek} onChange={(e) => setHoursPerWeek(e.target.value)} className="dk-input" placeholder="10" />
              </div>
              <div style={gap}>
                <FieldLabel htmlFor="listing-est">Total hours (estimate)</FieldLabel>
                <input id="listing-est" type="number" min={1} value={estHours} onChange={(e) => setEstHours(e.target.value)} className="dk-input" placeholder="60" />
              </div>
              <div style={gap}>
                <FieldLabel htmlFor="listing-duration">Duration</FieldLabel>
                <input id="listing-duration" value={duration} onChange={(e) => setDuration(e.target.value)} className="dk-input" placeholder="6 weeks" />
              </div>
              <div style={gap}>
                <FieldLabel htmlFor="listing-mode">Work mode</FieldLabel>
                <select id="listing-mode" value={workMode} onChange={(e) => setWorkMode(e.target.value)} className="dk-select">
                  <option value="remote">Remote</option>
                  <option value="in-person">In person</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
              <div style={gap}>
                <FieldLabel htmlFor="listing-team">Team size</FieldLabel>
                <input id="listing-team" type="number" min={1} max={20} value={teamSize} onChange={(e) => setTeamSize(e.target.value)} className="dk-input" placeholder="2" />
              </div>
              <div style={gap}>
                <FieldLabel htmlFor="listing-difficulty">Difficulty (1–10)</FieldLabel>
                <input id="listing-difficulty" type="number" min={1} max={10} value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="dk-input" placeholder="6" />
              </div>
            </div>

            {/* The poster's own questions. Blank uses the standard pair. */}
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.textSub }}>
                  Application questions <span style={{ fontWeight: 400, color: C.textMuted }}>(optional, up to 2)</span>
                </span>
                {agentsAvailable && (
                  <Button type="button" variant="outline" size="sm" onClick={suggestQuestions}
                    disabled={!title.trim() || brief.trim().length < 20} busyLabel={suggesting ? 'Writing…' : null}>
                    Suggest questions
                  </Button>
                )}
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {questions.map((q, i) => (
                  <textarea
                    key={i}
                    className="dk-textarea"
                    rows={2}
                    maxLength={300}
                    value={q.prompt}
                    onChange={(e) => setQuestions((qs) => qs.map((x, j) => (j === i ? { prompt: e.target.value, kind: 'custom', hint: '' } : x)))}
                    placeholder={i === 0
                      ? 'e.g. If this had to ship in half the time, what would you cut first?'
                      : 'e.g. What does this brief not tell you that you would need to know?'}
                    aria-label={`Application question ${i + 1}`}
                    style={{ fontFamily: 'inherit', fontSize: 14 }}
                  />
                ))}
              </div>
              <p style={{ fontSize: 13, color: C.textMuted, marginTop: 6 }}>
                Leave these blank to use our two standard questions.
              </p>
            </div>

            <Button type="submit" variant="accent" fullWidth disabled={saving} busyLabel={saving ? (editing ? 'Saving…' : 'Posting…') : null}>
              {editing ? 'Save changes' : 'Post project'}
            </Button>
            {editing && (
              <Button href={`/listings/${editing.id}`} variant="quiet" fullWidth>Cancel</Button>
            )}
          </form>
        </Card>
      </main>
    </div>
  )
}
