'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import Button from '@/components/ui/Button'
import Card from '@/components/Card'
import { Icon } from '@/components/Icon'
import EmailSection from './EmailSection'
import { C, F, R } from '@/lib/theme/dark-tokens'
import { LAYOUT } from '@/lib/theme/layout'
import { DEGREE_TYPES, GRAD_YEAR_MIN, GRAD_YEAR_MAX } from '@/lib/profile/details'
import { GRACE_DAYS } from '@/lib/account/deletion'

interface Profile {
  fullName: string
  university: string
  major: string
  degreeType: string
  graduationYear: number | null
}

/**
 * One screen for everything that belongs to you rather than to a page.
 *
 * It exists mostly because deleting an account did not have a home. It was a
 * link in the account dropdown, sitting one row above Sign out at the same
 * size in the same grey — so the most irreversible thing in the product was
 * rendered as the least remarkable, and a mis-click away from the thing
 * people do every day.
 *
 * Order is deliberate. Profile is what people come here for, so it is first
 * and open. Deleting is last, alone, below a rule, in red — not hidden, not
 * discouraged, just unmistakably a different kind of act from the four
 * things above it. Anyone looking for it will find it; nobody will hit it on
 * the way to something else.
 */
function Section({ id, title, lede, children }: {
  id: string
  title: string
  lede?: string
  children: React.ReactNode
}) {
  return (
    <section id={id} style={{ scrollMarginTop: 90 }}>
      <h2 style={{ fontFamily: F.display, fontSize: 17, fontWeight: 600, letterSpacing: '-0.015em', color: C.text, marginBottom: lede ? 5 : 13 }}>
        {title}
      </h2>
      {lede && (
        <p style={{ fontSize: 13.5, color: C.textMuted, lineHeight: 1.6, marginBottom: 15, maxWidth: '62ch' }}>
          {lede}
        </p>
      )}
      <Card hoverable={false} padding="19px 21px">{children}</Card>
    </section>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={htmlFor} style={{ fontSize: 13, fontWeight: 600, color: C.textSub }}>{label}</label>
      {children}
    </div>
  )
}

export default function SettingsClient({
  email,
  profile,
  hasStudentProfile,
  github,
  initialPrefs,
  initialUnsubscribedAll,
  notice,
}: {
  email: string | null
  profile: Profile
  hasStudentProfile: boolean
  github: { login: string | null; connectedAt: string | null } | null
  initialPrefs: Record<string, boolean>
  initialUnsubscribedAll: boolean
  notice: string | null
}) {
  const router = useRouter()
  const { toast } = useToast()

  const [form, setForm] = useState<Profile>(profile)
  const [saved, setSaved] = useState<Profile>(profile)
  const [saving, setSaving] = useState(false)

  const dirty =
    form.fullName !== saved.fullName ||
    form.university !== saved.university ||
    form.major !== saved.major ||
    form.degreeType !== saved.degreeType ||
    form.graduationYear !== saved.graduationYear

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function saveProfile() {
    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.fullName,
          university: form.university,
          major: form.major,
          degree_type: form.degreeType,
          graduation_year: form.graduationYear,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not save your details.')
      setSaved(form)
      toast('Saved.', 'success')
      // The navbar reads the name from the session, one level above this
      // page — without this it keeps the old initials until a hard reload.
      router.refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save your details.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="wm-app-ground" style={{ minHeight: '100vh', background: C.bg }}>
      <main
        id="main-content"
        style={{ maxWidth: 660, margin: '0 auto', padding: '34px 24px 96px' }}
      >
        <h1 style={{ fontFamily: F.display, fontSize: 26, fontWeight: 600, letterSpacing: '-0.022em', color: C.text, marginBottom: 6 }}>
          Settings
        </h1>
        <p style={{ fontSize: 14.5, color: C.textMuted, lineHeight: 1.6, marginBottom: 32 }}>
          {email ? <>Signed in as <span style={{ color: C.textSub }}>{email}</span>.</> : 'Your account.'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 34 }}>

          {/* ── Profile ─────────────────────────────────────────────────── */}
          {hasStudentProfile ? (
            <Section
              id="profile"
              title="Your details"
              lede="What a poster sees next to your record when you apply to their project."
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                <Field label="Name" htmlFor="set-name">
                  <input
                    id="set-name" className="dk-input" value={form.fullName}
                    onChange={(e) => set('fullName', e.target.value)}
                    autoComplete="name"
                  />
                </Field>

                <Field label="University" htmlFor="set-university">
                  <input
                    id="set-university" className="dk-input" value={form.university}
                    onChange={(e) => set('university', e.target.value)}
                  />
                </Field>

                <Field label="Major" htmlFor="set-major">
                  <input
                    id="set-major" className="dk-input" value={form.major}
                    onChange={(e) => set('major', e.target.value)}
                  />
                </Field>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }} className="mob-1col">
                  <Field label="Degree" htmlFor="set-degree">
                    <select
                      id="set-degree" className="dk-select" value={form.degreeType}
                      onChange={(e) => set('degreeType', e.target.value)}
                    >
                      <option value="">Not saying</option>
                      {DEGREE_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </Field>

                  <Field label="Graduation year" htmlFor="set-grad">
                    <input
                      id="set-grad" className="dk-input" type="number"
                      min={GRAD_YEAR_MIN} max={GRAD_YEAR_MAX} placeholder="2027"
                      value={form.graduationYear ?? ''}
                      onChange={(e) => set('graduationYear', e.target.value === '' ? null : Number(e.target.value))}
                    />
                  </Field>
                </div>

                {/* Beside the last field, not floating at the bottom of the
                    page, and disabled until there is something to save —
                    a Save button that is always live teaches people that
                    pressing it means nothing. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginTop: 3 }}>
                  <Button
                    variant="ink" size="sm"
                    onClick={saveProfile}
                    disabled={!dirty || !form.fullName.trim()}
                    busyLabel={saving ? 'Saving…' : null}
                  >
                    Save changes
                  </Button>
                  {dirty && !saving && (
                    <button
                      type="button"
                      onClick={() => setForm(saved)}
                      style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: 13, color: C.textFaint, textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer' }}
                    >
                      Discard
                    </button>
                  )}
                  {!dirty && !saving && (
                    <span style={{ fontSize: 12.5, color: C.textGhost }}>No unsaved changes</span>
                  )}
                </div>
              </div>
            </Section>
          ) : (
            <Section id="profile" title="Your details">
              <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6 }}>
                This account posts projects rather than building a record, so there is no student
                profile to edit here.
              </p>
            </Section>
          )}

          {/* ── Email ───────────────────────────────────────────────────── */}
          <Section
            id="email"
            title="Email"
            lede="Workmark only emails you when something happened that you can act on. Turn off whatever you don't want."
          >
            <EmailSection
              initialPrefs={initialPrefs}
              initialUnsubscribedAll={initialUnsubscribedAll}
              notice={notice}
            />
          </Section>

          {/* ── GitHub ──────────────────────────────────────────────────── */}
          {hasStudentProfile && (
            <Section
              id="github"
              title="GitHub"
              lede="Where every skill on your record comes from."
            >
              {github ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                    <span style={{ display: 'inline-flex', width: 32, height: 32, borderRadius: R.md, background: C.surfaceAlt, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon name="github" size={16} />
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.text }}>
                        {github.login ? `@${github.login}` : 'Connected'}
                      </span>
                      <span style={{ display: 'block', fontSize: 12.5, color: C.textGhost }}>
                        {github.connectedAt
                          ? `Connected ${new Date(github.connectedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
                          : 'Connected'}
                      </span>
                    </span>
                  </div>
                  <Button href="/student/github" variant="outline" size="sm">
                    Choose repositories
                  </Button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6, margin: 0 }}>
                    Not connected. Your record stays empty until it is.
                  </p>
                  <Button href="/student/github" variant="ink" size="sm">Connect GitHub</Button>
                </div>
              )}
            </Section>
          )}

          {/* ── Your data ───────────────────────────────────────────────── */}
          <Section
            id="data"
            title="Your data"
            lede="Everything Workmark holds about you, in one file, with no waiting and nobody to ask."
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6, margin: 0 }}>
                One JSON file: your profile, your skills, the evidence behind each one, your
                applications and your engagement history.
              </p>
              <a href="/api/account/export" download className="nb-btn nb-btn-outline nb-btn-sm">
                Download
              </a>
            </div>
          </Section>

          {/* ── Leaving ─────────────────────────────────────────────────── */}
          {/* Below a rule, at the end, on its own. The rule is the point:
              it says this is not the fifth item in a list, it is a
              different kind of thing. */}
          <section id="delete" style={{ scrollMarginTop: 90, borderTop: `1px solid ${C.border}`, paddingTop: 30 }}>
            <h2 style={{ fontFamily: F.display, fontSize: 17, fontWeight: 700, letterSpacing: '-0.015em', color: '#A32218', marginBottom: 5 }}>
              Delete your account
            </h2>
            <p style={{ fontSize: 13.5, color: C.textMuted, lineHeight: 1.6, marginBottom: 15, maxWidth: '62ch' }}>
              Your record, the evidence behind it and your history all go. You have {GRACE_DAYS} days
              to change your mind, and after that it is permanently gone — not by you, not by us,
              not by asking. The next page explains exactly what happens before anything does.
            </p>
            <Link href="/account/delete" className="nb-btn nb-btn-danger nb-btn-sm">
              Delete my account
            </Link>
          </section>

        </div>
      </main>
    </div>
  )
}
