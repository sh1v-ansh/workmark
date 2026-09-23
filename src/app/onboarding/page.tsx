'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import { C, F, R, state } from '@/lib/theme/dark-tokens'
import { Wordmark } from '@/app/landing/Wordmark'
import { Combobox } from '@/components/Combobox'
import { UNIVERSITIES } from '@/lib/data/universities'
import { MAJORS } from '@/lib/data/majors'
import { CONSENT_TEXT } from '@/lib/notify/marketing'
import { universityFromEmail } from '@/lib/profile/university-from-email'
import { track, currentSessionId } from '@/lib/analytics/track'
import IntentStep from './IntentStep'
import GithubStep from './GithubStep'
import type { Intent } from '@/lib/profile/intents'

// Asked before anything else, because a .edu address doesn't distinguish
// the two — professors have university email too. Without this branch a
// professor signs up, is asked for their graduation year, and silently
// becomes a student record with no error anyone would notice.
//
// Business accounts are still deferred: they'd fail the .edu check at the
// door and need domain ownership proof instead, which is a different
// problem from this one.
type Role = 'student' | 'faculty'

function RoleChoice({ title, body, onClick }: { title: string; body: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left', fontFamily: 'inherit', fontSize: 'inherit', cursor: 'pointer',
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.md,
        padding: '15px 18px',
      }}
    >
      <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 3 }}>{title}</span>
      <span style={{ display: 'block', fontSize: 13.5, color: C.textFaint, lineHeight: 1.5 }}>{body}</span>
    </button>
  )
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.textSub, marginBottom: 6.5 }}>
      {children}
    </label>
  )
}

function TagInput({ label, inputId, value, onChange, placeholder }: {
  label: string; inputId: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string
}) {
  const [input, setInput] = useState('')
  function add() {
    const trimmed = input.trim()
    if (trimmed && !value.includes(trimmed)) onChange([...value, trimmed])
    setInput('')
  }
  return (
    <div>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <div style={{ display: 'flex', gap: 8, marginBottom: 9 }}>
        <input
          id={inputId} type="text" value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } }}
          placeholder={placeholder ?? 'Add and press Enter'}
          className="dk-input" style={{ flex: 1 }}
        />
        <Button type="button" variant="outline" onClick={add}>Add</Button>
      </div>
      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {value.map((tag) => (
            <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 6.5, padding: '4.5px 5.5px 4.5px 11px', background: C.surfaceAlt, borderRadius: R.pill, fontSize: 13, color: C.textSub }}>
              {tag}
              <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} aria-label={`Remove ${tag}`} style={{ display: 'flex', background: 'none', border: 'none', color: C.textFaint, cursor: 'pointer', padding: 3, lineHeight: 1, borderRadius: '50%' }}>
                <span aria-hidden="true">×</span>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── student form ─────────────────────────────────────────────────────────────

function StudentForm({ onSubmit, loading, email, role }: {
  onSubmit: (data: Record<string, unknown>) => void
  loading: boolean
  email: string | null
  role: 'student' | 'faculty'
}) {
  const emailDomain = email ? `@${email.split('@')[1]}` : ''
  // Faculty skip the questions that only make sense for a degree in
  // progress. Asking a professor for their graduation year is how the
  // previous version quietly told them they were a student.
  const isStudent = role === 'student'
  const [fullName, setFullName] = useState('')
  // One box. Ticking it is the representation that they are 18 or over and
  // have agreed to the three documents it links to.
  const [agreed, setAgreed] = useState(false)
  // Its own box and its own state, deliberately not folded into `agreed`.
  // Consent bundled into accepting the terms is not freely given, and
  // consent that is not freely given is not consent. Starts false because a
  // pre-ticked box is invalid for the same reason.
  const [wantsOpportunities, setWantsOpportunities] = useState(false)
  const [heardAbout, setHeardAbout] = useState('')
  const [heardAboutDetail, setHeardAboutDetail] = useState('')
  // Prefilled where the email domain names exactly one institution, and
  // left empty otherwise. The picker is still the mechanism — a domain only
  // names a university if we already hold the mapping, and holding one for
  // every university in the country is an obligation nobody signed up for.
  // This just saves a step for the addresses we do know.
  const derived = universityFromEmail(email)
  const derivedUniversity = derived.name
  const [university, setUniversity] = useState(derivedUniversity ?? '')
  const [major, setMajor] = useState('')
  const [degreeType, setDegreeType] = useState('BS')
  const [graduationYear, setGraduationYear] = useState('')
  // Required for students: paid roles have work authorization (CPT) rules
  // for students on a visa, so this decides whether paid roles are shown.
  const [international, setInternational] = useState<'yes' | 'no' | ''>('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({
      full_name: fullName,
      age_attested: agreed,
      // Pulled out by the parent before the profile insert, like heard_about
      // — it belongs on the account, not on the profile the matcher reads.
      marketing_opt_in: wantsOpportunities,
      // Not part of the profile the scanner and matcher read — the parent
      // pulls these two out before the insert. See handleSubmit.
      heard_about: heardAbout || null,
      heard_about_detail: heardAbout === 'other' ? heardAboutDetail : null,
      university, major, degree_type: degreeType,
      graduation_year: graduationYear ? parseInt(graduationYear) : null,
      is_international: international === 'yes',
      // GPA is gone. It was the one number on this page nobody could check,
      // and a product whose whole claim is "this is verified" should not be
      // collecting a self-reported grade beside it.
      //
      // Major, links, availability and self-declared skills are not gone —
      // they are asked after the first scan, when somebody has seen what
      // this is for. Every field before that moment is a chance to leave,
      // and none of them is needed to produce a record.
    })
  }

  const gap: React.CSSProperties = { display: 'flex', flexDirection: 'column' }


  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ ...gap, gridColumn: '1 / -1' }}>
          <FieldLabel htmlFor="student-full-name">Full name <span aria-hidden="true" style={{ color: C.accent }}>*</span><span className="sr-only"> (required)</span></FieldLabel>
          <input id="student-full-name" required autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="dk-input" placeholder="Jane Smith" />
        </div>
        <div style={{ ...gap, gridColumn: '1 / -1' }}>
          <FieldLabel htmlFor="student-university">University <span aria-hidden="true" style={{ color: C.accent }}>*</span><span className="sr-only"> (required)</span></FieldLabel>
          {/* Prefilled from the email domain when that is unambiguous, and a
              plain picker otherwise. The picker stays the mechanism: a
              domain only names an institution if we already hold the
              mapping, and holding a mapping for every university in the
              country is an obligation nobody signed up for. */}
          <Combobox id="student-university" value={university} onChange={setUniversity} options={UNIVERSITIES} placeholder="Search universities…" required />
          {derivedUniversity && university === derivedUniversity && (
            <p style={{ fontSize: 13, color: C.textGhost, lineHeight: 1.5, marginTop: 5 }}>
              From your {emailDomain} address — change it if that is not right.
            </p>
          )}
        </div>
        {isStudent && <div style={gap}>
          <FieldLabel htmlFor="student-degree">Degree</FieldLabel>
          <select id="student-degree" value={degreeType} onChange={(e) => setDegreeType(e.target.value)} className="dk-select">
            <option value="BS">BS</option>
            <option value="MS">MS</option>
            <option value="PhD">PhD</option>
            <option value="BA">BA</option>
            <option value="Other">Other</option>
          </select>
        </div>}
        {isStudent && <div style={gap}>
          <FieldLabel htmlFor="student-grad-year">Graduation year</FieldLabel>
          <input id="student-grad-year" type="number" min={2024} max={2035} value={graduationYear} onChange={(e) => setGraduationYear(e.target.value)} className="dk-input" placeholder="2026" />
        </div>}
        {isStudent && (
          <fieldset style={{ ...gap, gridColumn: '1 / -1', border: 'none', margin: 0, padding: 0 }}>
            <legend style={{ fontSize: 13, fontWeight: 600, color: C.textSub, marginBottom: 7 }}>
              Are you an international student on a student visa (for example F-1 or J-1)? <span aria-hidden="true" style={{ color: C.accent }}>*</span><span className="sr-only"> (required)</span>
            </legend>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['no', 'yes'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={international === v}
                  onClick={() => setInternational(v)}
                  className="dk-input"
                  style={{
                    width: 'auto', padding: '8px 18px', cursor: 'pointer', fontWeight: 600,
                    borderColor: international === v ? C.accent : undefined,
                    color: international === v ? C.accent : C.text,
                    background: international === v ? '#F4F1FF' : undefined,
                  }}
                >
                  {v === 'yes' ? 'Yes' : 'No'}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {!isStudent && <div style={{ ...gap, gridColumn: '1 / -1' }}>
          <FieldLabel htmlFor="student-major">Department</FieldLabel>
          <Combobox id="student-major" value={major} onChange={setMajor} options={MAJORS} placeholder="e.g. Computer Science" />
        </div>}
      </div>

      {/* Age and terms.
          A statement, not a birthday. Asking every account for a date of
          birth is the thorough-looking option and the worse one: it puts
          sensitive data in the database for everybody to answer one yes/no
          question, and knowing someone's age is what creates the duty
          around minors in the first place. Every comparable platform states
          the minimum in the terms and takes signup as the representation.

          Under 18 is refused rather than held. An earlier version saved the
          profile and opened the account on the eighteenth birthday, which
          was kinder — but it put the product in direct conflict with its own
          Terms, which say under-18s may not register at all. One true rule
          beats a nice feature the legal documents contradict. */}
      {/* The only question on this form that is for us rather than for the
          person filling it in, so it goes last, says it is optional, and
          offers "Prefer not to say" as a real answer rather than making
          somebody pick a lie to get past it. */}
      <div style={gap}>
        <FieldLabel htmlFor="student-heard">How did you hear about Workmark? <span style={{ fontWeight: 400, color: C.textGhost }}>Optional</span></FieldLabel>
        <select id="student-heard" value={heardAbout} onChange={(e) => setHeardAbout(e.target.value)} className="dk-select">
          <option value="">Select…</option>
          <option value="friend">A friend or classmate</option>
          <option value="professor">A professor or advisor</option>
          <option value="club_or_society">A club or student society</option>
          <option value="social_media">Social media</option>
          <option value="search">Search</option>
          <option value="event">An event or hackathon</option>
          <option value="other">Something else</option>
          <option value="prefer_not_to_say">Prefer not to say</option>
        </select>
        {heardAbout === 'other' && (
          <input
            value={heardAboutDetail}
            onChange={(e) => setHeardAboutDetail(e.target.value)}
            className="dk-input"
            maxLength={200}
            placeholder="Where did you come across it?"
            aria-label="How you heard about Workmark"
            style={{ marginTop: 9 }}
          />
        )}
      </div>

      <div style={{ background: C.surfaceAlt, borderRadius: R.md, padding: 16 }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
          <input
            id="student-terms" type="checkbox" checked={agreed} required
            onChange={(e) => setAgreed(e.target.checked)}
            className="dk-checkbox" style={{ marginTop: 2 }}
          />
          <span style={{ fontSize: 13.5, color: C.textMuted, lineHeight: 1.6 }}>
            I&apos;m 18 or over, and I agree to the{' '}
            <Link href="/legal/terms" target="_blank" rel="noopener" style={{ color: C.text, textDecoration: 'underline' }}>Terms of Service</Link>,{' '}
            <Link href="/legal/privacy" target="_blank" rel="noopener" style={{ color: C.text, textDecoration: 'underline' }}>Privacy Policy</Link>{' '}
            and{' '}
            <Link href="/legal/cookies" target="_blank" rel="noopener" style={{ color: C.text, textDecoration: 'underline' }}>Cookie Policy</Link>.
          </span>
        </label>
        <p style={{ fontSize: 13, color: C.textGhost, lineHeight: 1.55, marginTop: 10, paddingLeft: 25 }}>
          Workmark accounts are for people aged 18 and over. Each link opens in a new tab, so
          you won&apos;t lose what you&apos;ve filled in.
        </p>
      </div>

      {/* Opportunities — its own box, its own decision, unticked.
          Three rules that look like fussiness and are not:

          Separate from the terms box, because bundling marketing consent
          into "I agree to the Terms" makes it not freely given, and consent
          that is not freely given is not consent (GDPR Art. 4(11)). One box
          for both would be the most common way this is got wrong.

          Unticked, for the same reason. A pre-ticked box is specifically
          named as invalid in Art. 4(11) and in the Planet49 ruling.

          Not required, so the button works either way. If refusing it
          blocked the account it would not be freely given either. */}
      <div style={{ background: C.surfaceAlt, borderRadius: R.md, padding: 16 }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
          <input
            id="student-marketing" type="checkbox" checked={wantsOpportunities}
            onChange={(e) => setWantsOpportunities(e.target.checked)}
            className="dk-checkbox" style={{ marginTop: 2 }}
          />
          <span style={{ fontSize: 13.5, color: C.textMuted, lineHeight: 1.6 }}>
            {CONSENT_TEXT}
          </span>
        </label>
        <p style={{ fontSize: 13, color: C.textGhost, lineHeight: 1.55, marginTop: 10, paddingLeft: 25 }}>
          Optional. You will still get emails about your own applications and projects.
        </p>
      </div>

      <Button type="submit" variant="accent" fullWidth disabled={loading || !agreed || (isStudent && !international)} busyLabel={loading ? 'Saving profile…' : null}>
        Complete profile
      </Button>
    </form>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(false)
  /**
   * Which screen is showing.
   *
   * 'profile' creates the account; everything after it patches. That split
   * is what makes this resumable — onboarding used to be one submit of
   * eighteen fields, so somebody who closed the tab halfway had no account,
   * no row and nothing to come back to.
   */
  const [step, setStep] = useState<'profile' | 'intents' | 'github'>('profile')

  // Fired once, on arrival. Without it the funnel can see that somebody
  // submitted the signup form and that somebody finished a profile, and
  // nothing about the gap between — which is where the eighteen-field form
  // was losing people and why this screen was rebuilt.
  useEffect(() => { track('onboarding_started') }, [])
  const [intents, setIntents] = useState<Intent[]>([])
  const [userEmail, setUserEmail] = useState('')
  const [userId, setUserId] = useState('')
  const [checking, setChecking] = useState(true)
  // Asked before anything else. Professors have .edu addresses too, so the
  // email check can't tell them apart — without this a professor signs up,
  // gets asked for their graduation year, and silently becomes a student.
  const [role, setRole] = useState<'student' | 'faculty' | null>(null)

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Already onboarded — landing here again (back button, a second
      // tab, a retried signup) should reach the dashboard, not a form the
      // server will refuse.
      //
      // The account row is the signal, not the student row: faculty don't
      // get a student row at all, so checking `students` would show a
      // professor the signup form again every time they came back.
      const { data: account } = await supabase
        .from('accounts')
        .select('roles, onboarding_step')
        .eq('id', user.id)
        .maybeSingle()

      // Part-way through: the account exists but they closed the tab before
      // the last screen. Pick up where they stopped. This is the whole point
      // of creating the account after the first screen — before, anyone who
      // left halfway started again from the first field.
      const resumeAt = account?.onboarding_step
      if (account && (resumeAt === 'intents' || resumeAt === 'github')) {
        setUserId(user.id)
        setUserEmail(user.email ?? '')
        setRole('student')
        setStep(resumeAt)
        setChecking(false)
        return
      }

      if (account) {
        const roles = (account.roles ?? []) as string[]
        const facultyOnly = roles.includes('faculty') && !roles.includes('student')
        router.replace(facultyOnly ? '/faculty' : '/student/dashboard')
        return
      }

      setUserId(user.id)
      setUserEmail(user.email ?? '')
      setChecking(false)
    }
    loadUser()
  }, [router])

  async function handleStudentSubmit(data: Record<string, unknown>) {
    if (!userId) return
    setLoading(true)
    try {
      // Goes through the server rather than writing directly: `accounts` has
      // no insert policy for users on purpose, because an account row says
      // what someone is allowed to be. A client that could write it could
      // grant itself admin.
      const { heard_about, heard_about_detail, marketing_opt_in, ...rest } = data as Record<string, unknown>
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // heard_about belongs to the account, not to the student profile
        // the scanner and matcher read, so it travels beside it. The form
        // collects everything in one object; this is where they part.
        body: JSON.stringify({
          role,
          profile: rest,
          heardAbout: heard_about ?? undefined,
          heardAboutDetail: heard_about_detail ?? undefined,
          marketingOptIn: marketing_opt_in === true,
          analyticsSessionId: currentSessionId(),
        }),
      })
      const json = await res.json()

      // Already set up — two tabs, a double submit, a stale form. Nothing
      // went wrong for the person, so send them on rather than showing an
      // error for a state that is actually success.
      if (res.status === 409 && json.alreadyOnboarded) {
        router.replace(role === 'faculty' ? '/faculty' : '/student/dashboard')
        return
      }

      // The reference is shown with the message: it names the database rule
      // that refused the write, which is the only useful thing to report.
      if (!res.ok) throw new Error(`${json.error ?? 'Failed to save profile.'}${json.ref ? ` (${json.ref})` : ''}`)

      // Faculty go to their own home. Sending them to the student dashboard
      // would ask about their skills, their record and their GitHub — none
      // of which they have. They also skip the intents screen: the four
      // things it offers are all student-side.
      if (role === 'faculty') {
        toast('Profile saved. You can start now — we\'ll confirm your faculty status shortly.', 'success')
        router.push('/faculty')
        router.refresh()
        return
      }

      // The account exists from here on, so everything after this point is
      // resumable rather than all-or-nothing. A student who closes the tab
      // now comes back to the screen they stopped at instead of the first
      // field of a form they already filled in.
      track('onboarding_role_chosen', { role })
      setStep('intents')
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to save profile.', 'error')
    } finally {
      setLoading(false)
    }
  }

  /**
   * What they came for, then on to the dashboard.
   *
   * Failing to save is not a reason to trap somebody on a screen they can
   * skip anyway: the answer orders their dashboard and nothing rests on it,
   * so a failed write is worth a toast and a shrug rather than a wall.
   */
  async function saveIntents() {
    setLoading(true)
    try {
      const res = await fetch('/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intents, step: 'github' }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not save that.')
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Could not save that.', 'error')
    } finally {
      setLoading(false)
      setStep('github')
    }
  }

  /**
   * Leave onboarding without connecting GitHub.
   *
   * A real option, not a trap door: somebody signing up on a phone between
   * lectures cannot install a GitHub App there, and making them choose
   * between that and not having an account loses them. The dashboard picks
   * the thread back up — its first card is the GitHub step.
   */
  async function skipGithub() {
    setLoading(true)
    try {
      await fetch('/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'done' }),
      })
    } finally {
      setLoading(false)
      router.push('/student/dashboard')
      router.refresh()
    }
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const emailDomain = userEmail ? `@${userEmail.split('@')[1]}` : ''
  const eduInvalid = !!userEmail && !validateEdu(userEmail)

  return (
    <main className="wm-app-ground" style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '44px 24px' }}>
      <div style={{ width: '100%', maxWidth: 550, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 36 }}>
        <Link href="/" aria-label="Workmark home" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <Wordmark height={24} />
        </Link>
        {userEmail && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 11.5 }}>
            <span style={{ fontSize: 13, color: C.textGhost }}>{userEmail}</span>
            <button type="button" onClick={handleSignOut} className="nb-btn nb-btn-outline nb-btn-sm">Sign out</button>
          </div>
        )}
      </div>

      <div style={{ width: '100%', maxWidth: 550 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: 30 }}>
          {/* Where they are, and how much is left. Three screens is short
              enough that a bar would be more chrome than information, so it
              says it in words. Faculty see one screen and no count. */}
          {role === 'student' && (
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: C.textGhost, marginBottom: 9 }}>
              Step {step === 'profile' ? 1 : step === 'intents' ? 2 : 3} of 3
            </p>
          )}

          <h1 style={{ fontFamily: F.display, fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: C.text, marginBottom: 7.5 }}>
            {step === 'intents' ? 'What do you want to do here?' : step === 'github' ? 'Connect GitHub' : 'Welcome to Workmark'}
          </h1>
          {step === 'profile' && (
            <p style={{ fontSize: 14, color: C.textMuted, marginBottom: 23, lineHeight: 1.6 }}>
              {role === null
                ? 'First, which are you? This changes what we ask for next.'
                : role === 'faculty'
                  ? 'Set up your profile. You can post course and research projects straight away.'
                  : 'Just the basics — your record comes from the code you write, not from this form.'}
            </p>
          )}

          {step === 'github' ? (
            <GithubStep onSkip={skipGithub} busy={loading} />
          ) : step === 'intents' ? (
            <IntentStep
              chosen={intents}
              onChange={setIntents}
              onContinue={saveIntents}
              busy={loading}
            />
          ) : checking ? (
            <p style={{ fontSize: 14, color: C.textFaint }}>Loading…</p>
          ) : eduInvalid ? (
            <div role="alert" style={{ background: state.cautionBg, borderRadius: R.md, padding: '13px 16.5px', fontSize: 14, color: '#6B3A0A', lineHeight: 1.6 }}>
              Your email <strong>{userEmail}</strong> is not a .edu address. Workmark accounts require a university email to verify student status. Sign out and sign up again with your university address.
            </div>
          ) : role === null ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <RoleChoice
                title="I'm a student"
                body="Build a verified record from the code you write, and take on projects."
                onClick={() => setRole('student')}
              />
              <RoleChoice
                title="I teach or run a lab"
                body="Post course and research projects, and confirm the work students did with you. We'll confirm your faculty status afterwards."
                onClick={() => setRole('faculty')}
              />
              <p style={{ fontSize: 13, color: C.textGhost, lineHeight: 1.55, marginTop: 4 }}>
                Faculty accounts work right away. We confirm them separately — until then your
                confirmations carry the same weight as a student&apos;s.
              </p>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setRole(null)}
                style={{ background: 'none', border: 'none', padding: 0, marginBottom: 16, fontFamily: 'inherit', fontSize: 13, color: C.textFaint, cursor: 'pointer' }}
              >
                ← Not {role === 'faculty' ? 'faculty' : 'a student'}?
              </button>
              <StudentForm
                onSubmit={handleStudentSubmit}
                loading={loading}
                email={userEmail}
                role={role}
              />
            </>
          )}
        </div>
      </div>
    </main>
  )
}

function validateEdu(email: string): boolean {
  return email.toLowerCase().endsWith('.edu')
}
