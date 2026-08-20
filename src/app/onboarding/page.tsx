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

// Student-only in MVP: company/faculty accounts are deferred to Tier 1+
// and have no table in the v0.5 schema to write a profile into.
type Role = 'student'

// ─── helpers ──────────────────────────────────────────────────────────────────

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.textSub, marginBottom: 7 }}>
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
            <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 6px 5px 12px', background: C.surfaceAlt, borderRadius: R.pill, fontSize: 13.5, color: C.textSub }}>
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

function StudentForm({ onSubmit, loading, emailDomain }: {
  onSubmit: (data: Record<string, unknown>) => void; loading: boolean; emailDomain: string
}) {
  const [fullName, setFullName] = useState('')
  const [university, setUniversity] = useState('')
  const [major, setMajor] = useState('')
  const [degreeType, setDegreeType] = useState('BS')
  const [graduationYear, setGraduationYear] = useState('')
  const [gpa, setGpa] = useState('')
  const [isInternational, setIsInternational] = useState(false)
  const [visaType, setVisaType] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [githubUrl, setGithubUrl] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [availability, setAvailability] = useState('full-time')
  const [hoursPerWeek, setHoursPerWeek] = useState('')
  const [availableFrom, setAvailableFrom] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({
      full_name: fullName, university, major, degree_type: degreeType,
      graduation_year: graduationYear ? parseInt(graduationYear) : null,
      gpa: gpa ? parseFloat(gpa) : null,
      is_international: isInternational, visa_type: isInternational ? visaType : null,
      skills, github_url: githubUrl || null, linkedin_url: linkedinUrl || null,
      availability, hours_per_week: hoursPerWeek ? parseInt(hoursPerWeek) : null,
      available_from: availableFrom || null,
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
          <Combobox id="student-university" value={university} onChange={setUniversity} options={UNIVERSITIES} placeholder="Search universities…" required />
        </div>
        <div style={gap}>
          <FieldLabel htmlFor="student-major">Major</FieldLabel>
          <Combobox id="student-major" value={major} onChange={setMajor} options={MAJORS} placeholder="Search majors…" />
        </div>
        <div style={gap}>
          <FieldLabel htmlFor="student-degree">Degree</FieldLabel>
          <select id="student-degree" value={degreeType} onChange={(e) => setDegreeType(e.target.value)} className="dk-select">
            <option value="BS">BS</option>
            <option value="MS">MS</option>
            <option value="PhD">PhD</option>
            <option value="BA">BA</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div style={gap}>
          <FieldLabel htmlFor="student-grad-year">Graduation year</FieldLabel>
          <input id="student-grad-year" type="number" min={2024} max={2035} value={graduationYear} onChange={(e) => setGraduationYear(e.target.value)} className="dk-input" placeholder="2026" />
        </div>
        <div style={gap}>
          <FieldLabel htmlFor="student-gpa">GPA</FieldLabel>
          <input id="student-gpa" type="number" min={0} max={4} step={0.01} value={gpa} onChange={(e) => setGpa(e.target.value)} className="dk-input" placeholder="3.80" />
        </div>
      </div>

      <TagInput label="Skills (press Enter to add)" inputId="student-skills" value={skills} onChange={setSkills} placeholder="e.g. Python, React, SQL" />

      <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={gap}>
          <FieldLabel htmlFor="student-github">GitHub URL</FieldLabel>
          <input id="student-github" type="url" autoComplete="url" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} className="dk-input" placeholder="https://github.com/you" />
        </div>
        <div style={gap}>
          <FieldLabel htmlFor="student-linkedin">LinkedIn URL</FieldLabel>
          <input id="student-linkedin" type="url" autoComplete="url" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} className="dk-input" placeholder="https://linkedin.com/in/you" />
        </div>
        <div style={gap}>
          <FieldLabel htmlFor="student-availability">Availability</FieldLabel>
          <select id="student-availability" value={availability} onChange={(e) => setAvailability(e.target.value)} className="dk-select">
            <option value="full-time">Full-time</option>
            <option value="part-time">Part-time</option>
          </select>
        </div>
        <div style={gap}>
          <FieldLabel htmlFor="student-hours">Hours per week</FieldLabel>
          <input id="student-hours" type="number" min={1} max={60} value={hoursPerWeek} onChange={(e) => setHoursPerWeek(e.target.value)} className="dk-input" placeholder="20" />
        </div>
        <div style={gap}>
          <FieldLabel htmlFor="student-available-from">Available from</FieldLabel>
          <input id="student-available-from" type="date" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} className="dk-input" />
        </div>
      </div>

      <div style={{ background: C.surfaceAlt, borderRadius: R.md, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input id="student-international" type="checkbox" checked={isInternational} onChange={(e) => setIsInternational(e.target.checked)} className="dk-checkbox" />
          <span style={{ fontSize: 15, color: C.textMuted }}>I am an international student</span>
        </label>
        {isInternational && (
          <div style={gap}>
            <FieldLabel htmlFor="student-visa">Visa / work auth type</FieldLabel>
            <select id="student-visa" value={visaType} onChange={(e) => setVisaType(e.target.value)} className="dk-select">
              <option value="">Select…</option>
              <option value="F-1">F-1 (CPT/OPT eligible)</option>
              <option value="J-1">J-1</option>
              <option value="OPT">OPT</option>
              <option value="CPT">CPT</option>
              <option value="H-1B">H-1B</option>
              <option value="Other">Other</option>
            </select>
          </div>
        )}
      </div>

      {emailDomain && (
        <p style={{ fontSize: 14, color: C.textGhost }}>Signing up with <strong style={{ color: C.textMuted }}>{emailDomain}</strong></p>
      )}

      <Button type="submit" variant="accent" fullWidth disabled={loading} busyLabel={loading ? 'Saving profile…' : null}>
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
  const [userEmail, setUserEmail] = useState('')
  const [userId, setUserId] = useState('')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Already onboarded — landing here again (back button, a second
      // tab, a retried signup) should reach the dashboard, not a form
      // whose insert would fail on the primary key.
      const { data: existing } = await supabase.from('students').select('id').eq('id', user.id).maybeSingle()
      if (existing) { router.replace('/student/dashboard'); return }

      setUserId(user.id)
      setUserEmail(user.email ?? '')
      setChecking(false)
    }
    loadUser()
  }, [router])

  async function handleStudentSubmit(data: Record<string, unknown>) {
    if (!userId) return
    setLoading(true)
    const supabase = createClient()
    try {
      // edu_domain/edu_verified_at are the permanent record of how this
      // account was verified as a student. The login email can change
      // later (a .edu expires at graduation); this pair does not.
      const domain = userEmail.split('@')[1] ?? null
      const { error } = await supabase.from('students').insert({
        id: userId,
        ...data,
        edu_domain: domain,
        edu_verified_at: new Date().toISOString(),
      })
      if (error) {
        // 23505 = primary key: a profile already exists, which is a
        // success state for the user even though the insert failed.
        if (error.code === '23505') { router.replace('/student/dashboard'); return }
        throw error
      }
      toast('Profile saved. Welcome to Workmark.', 'success')
      router.push('/student/dashboard'); router.refresh()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to save profile.', 'error')
    } finally {
      setLoading(false)
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
    <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px' }}>
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
        <Link href="/" aria-label="Workmark home" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <Wordmark height={26} />
        </Link>
        {userEmail && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 14, color: C.textGhost }}>{userEmail}</span>
            <button type="button" onClick={handleSignOut} className="nb-btn nb-btn-outline nb-btn-sm">Sign out</button>
          </div>
        )}
      </div>

      <div style={{ width: '100%', maxWidth: 560 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: 34 }}>
          <h1 style={{ fontFamily: F.display, fontSize: 25, fontWeight: 700, letterSpacing: '-0.02em', color: C.text, marginBottom: 8 }}>Welcome to Workmark</h1>
          <p style={{ fontSize: 15, color: C.textMuted, marginBottom: 26, lineHeight: 1.6 }}>
            Set up your student profile. Your verified skill record comes from the repos you link — this is just the basics.
          </p>

          {checking ? (
            <p style={{ fontSize: 15, color: C.textFaint }}>Loading…</p>
          ) : eduInvalid ? (
            <div role="alert" style={{ background: state.cautionBg, borderRadius: R.md, padding: '14px 18px', fontSize: 15, color: '#6B3A0A', lineHeight: 1.6 }}>
              Your email <strong>{userEmail}</strong> is not a .edu address. Workmark accounts require a university email to verify student status. Sign out and sign up again with your university address.
            </div>
          ) : (
            <StudentForm onSubmit={handleStudentSubmit} loading={loading} emailDomain={emailDomain} />
          )}
        </div>
      </div>
    </main>
  )
}

function validateEdu(email: string): boolean {
  return email.toLowerCase().endsWith('.edu')
}
