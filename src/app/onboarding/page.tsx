'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import Link from 'next/link'
import { C, F } from '@/app/landing/tokens'
import { LogoMark } from '@/app/landing/LogoMark'
import { Combobox } from '@/components/Combobox'
import { UNIVERSITIES } from '@/lib/data/universities'
import { MAJORS } from '@/lib/data/majors'
import { INDUSTRIES } from '@/lib/data/industries'

type Role = 'student' | 'company' | 'faculty'
type Step = 1 | 2

// ─── helpers ──────────────────────────────────────────────────────────────────

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} style={{ display: 'block', fontFamily: F.mono, fontSize: 10, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 6 }}>
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
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          id={inputId} type="text" value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } }}
          placeholder={placeholder ?? 'Add and press Enter'}
          className="dk-input" style={{ flex: 1 }}
        />
        <button type="button" onClick={add} style={{ padding: '0 14px', background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.textMuted, fontFamily: F.mono, fontSize: 11, cursor: 'pointer' }}>
          Add
        </button>
      </div>
      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {value.map((tag) => (
            <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', background: C.surfaceAlt, border: `1px solid ${C.border}`, fontSize: 11, color: C.textSub, fontFamily: F.mono }}>
              {tag}
              <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} aria-label={`Remove ${tag}`} style={{ background: 'none', border: 'none', color: C.textFaint, cursor: 'pointer', padding: 0, lineHeight: 1 }}>
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

  const gap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
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

      <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input id="student-international" type="checkbox" checked={isInternational} onChange={(e) => setIsInternational(e.target.checked)} className="dk-checkbox" />
          <span style={{ fontSize: 13, color: C.textMuted }}>I am an international student</span>
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
        <p style={{ fontSize: 11, color: C.textFaint, fontFamily: F.mono }}>Signing up with <strong style={{ color: C.textMuted }}>{emailDomain}</strong></p>
      )}

      <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px 0', background: loading ? C.surfaceAlt : C.accent, color: loading ? C.textMuted : C.bg, fontFamily: F.mono, fontSize: 13, fontWeight: 500, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em', transition: 'all 0.2s' }}>
        {loading ? 'Saving profile…' : 'Complete profile →'}
      </button>
    </form>
  )
}

// ─── company form ─────────────────────────────────────────────────────────────

function CompanyForm({ onSubmit, loading }: {
  onSubmit: (data: Record<string, unknown>) => void; loading: boolean
}) {
  const [companyName, setCompanyName] = useState('')
  const [website, setWebsite] = useState('')
  const [industry, setIndustry] = useState('')
  const [companySize, setCompanySize] = useState('1-10')
  const [hqLocation, setHqLocation] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({ company_name: companyName, website: website || null, industry: industry || null, company_size: companySize, hq_location: hqLocation || null, contact_name: contactName, contact_email: contactEmail })
  }

  const gap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={gap}>
        <FieldLabel htmlFor="company-name">Company name <span aria-hidden="true" style={{ color: C.accent }}>*</span><span className="sr-only"> (required)</span></FieldLabel>
        <input id="company-name" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="dk-input" placeholder="Acme Inc." />
      </div>

      <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={gap}>
          <FieldLabel htmlFor="company-website">Website</FieldLabel>
          <input id="company-website" type="url" autoComplete="url" value={website} onChange={(e) => setWebsite(e.target.value)} className="dk-input" placeholder="https://acme.com" />
        </div>
        <div style={gap}>
          <FieldLabel htmlFor="company-industry">Industry</FieldLabel>
          <Combobox id="company-industry" value={industry} onChange={setIndustry} options={INDUSTRIES} placeholder="Search industries…" />
        </div>
        <div style={gap}>
          <FieldLabel htmlFor="company-size">Company size</FieldLabel>
          <select id="company-size" value={companySize} onChange={(e) => setCompanySize(e.target.value)} className="dk-select">
            <option value="1-10">1–10</option>
            <option value="11-50">11–50</option>
            <option value="51-200">51–200</option>
            <option value="200+">200+</option>
          </select>
        </div>
        <div style={gap}>
          <FieldLabel htmlFor="company-hq">HQ location</FieldLabel>
          <input id="company-hq" value={hqLocation} onChange={(e) => setHqLocation(e.target.value)} className="dk-input" placeholder="San Francisco, CA" />
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <p style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Primary contact</p>
        <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={gap}>
            <FieldLabel htmlFor="company-contact-name">Contact name <span aria-hidden="true" style={{ color: C.accent }}>*</span><span className="sr-only"> (required)</span></FieldLabel>
            <input id="company-contact-name" required autoComplete="name" value={contactName} onChange={(e) => setContactName(e.target.value)} className="dk-input" placeholder="Jane Smith" />
          </div>
          <div style={gap}>
            <FieldLabel htmlFor="company-contact-email">Contact email <span aria-hidden="true" style={{ color: C.accent }}>*</span><span className="sr-only"> (required)</span></FieldLabel>
            <input id="company-contact-email" required type="email" autoComplete="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="dk-input" placeholder="jane@acme.com" />
          </div>
        </div>
      </div>

      <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px 0', background: loading ? C.surfaceAlt : C.accent, color: loading ? C.textMuted : C.bg, fontFamily: F.mono, fontSize: 13, fontWeight: 500, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em', transition: 'all 0.2s' }}>
        {loading ? 'Saving…' : 'Complete profile →'}
      </button>
    </form>
  )
}

// ─── faculty form ─────────────────────────────────────────────────────────────

function FacultyForm({ onSubmit, loading, email }: {
  onSubmit: (data: Record<string, unknown>) => void; loading: boolean; email: string
}) {
  const [fullName, setFullName] = useState('')
  const [institution, setInstitution] = useState('')
  const [department, setDepartment] = useState('')
  const [title, setTitle] = useState('Professor')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({ full_name: fullName, institution, department: department || null, title, email })
  }

  const gap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={gap}>
        <FieldLabel htmlFor="faculty-name">Full name <span aria-hidden="true" style={{ color: C.accent }}>*</span><span className="sr-only"> (required)</span></FieldLabel>
        <input id="faculty-name" required autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="dk-input" placeholder="Dr. Jane Smith" />
      </div>
      <div style={gap}>
        <FieldLabel htmlFor="faculty-institution">Institution <span aria-hidden="true" style={{ color: C.accent }}>*</span><span className="sr-only"> (required)</span></FieldLabel>
        <Combobox id="faculty-institution" value={institution} onChange={setInstitution} options={UNIVERSITIES} placeholder="Search universities…" required />
      </div>
      <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={gap}>
          <FieldLabel htmlFor="faculty-dept">Department</FieldLabel>
          <input id="faculty-dept" value={department} onChange={(e) => setDepartment(e.target.value)} className="dk-input" placeholder="Computer Science" />
        </div>
        <div style={gap}>
          <FieldLabel htmlFor="faculty-title">Title</FieldLabel>
          <select id="faculty-title" value={title} onChange={(e) => setTitle(e.target.value)} className="dk-select">
            <option value="Professor">Professor</option>
            <option value="Associate Professor">Associate Professor</option>
            <option value="Assistant Professor">Assistant Professor</option>
            <option value="Postdoctoral Researcher">Postdoctoral Researcher</option>
            <option value="Research Scientist">Research Scientist</option>
            <option value="Lecturer">Lecturer</option>
            <option value="Instructor">Instructor</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>
      <div style={gap}>
        <FieldLabel htmlFor="faculty-email">Institutional email</FieldLabel>
        <input id="faculty-email" type="email" readOnly value={email} className="dk-input" style={{ opacity: 0.6, cursor: 'default' }} />
        <p style={{ fontSize: 11, fontFamily: F.mono, color: C.textFaint, marginTop: 4 }}>Used to verify your institutional affiliation</p>
      </div>
      <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px 0', background: loading ? C.surfaceAlt : C.accent, color: loading ? C.textMuted : C.bg, fontFamily: F.mono, fontSize: 13, fontWeight: 500, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em', transition: 'all 0.2s' }}>
        {loading ? 'Saving profile…' : 'Complete profile →'}
      </button>
    </form>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [step, setStep] = useState<Step>(1)
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [userId, setUserId] = useState('')

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      setUserEmail(user.email ?? '')
      const metaRole = user.user_metadata?.role as Role | undefined
      if (metaRole) { setRole(metaRole); setStep(2) }
    }
    loadUser()
  }, [router])

  async function handleStudentSubmit(data: Record<string, unknown>) {
    if (!userId) return
    setLoading(true)
    const supabase = createClient()
    try {
      const { error } = await supabase.from('students').insert({ id: userId, ...data })
      if (error) throw error
      toast('Profile saved! Welcome to Workmark.', 'success')
      router.push('/student/dashboard'); router.refresh()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to save profile.', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleCompanySubmit(data: Record<string, unknown>) {
    if (!userId) return
    setLoading(true)
    const supabase = createClient()
    try {
      const { error } = await supabase.from('companies').insert({ id: userId, ...data })
      if (error) throw error
      toast('Company profile saved! Welcome to Workmark.', 'success')
      router.push('/company/dashboard'); router.refresh()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to save profile.', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleFacultySubmit(data: Record<string, unknown>) {
    if (!userId) return
    setLoading(true)
    const supabase = createClient()
    try {
      const { error } = await supabase.from('faculty').insert({ id: userId, ...data })
      if (error) throw error
      toast('Faculty profile saved! Welcome to Workmark.', 'success')
      router.push('/faculty/dashboard'); router.refresh()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to save profile.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const emailDomain = userEmail ? `@${userEmail.split('@')[1]}` : ''

  return (
    <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px' }}>
      <Link href="/" aria-label="Workmark home" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 40 }}>
        <LogoMark size={22} />
        <span style={{ fontFamily: F.mono, fontSize: 16, fontWeight: 500, color: C.text, letterSpacing: '-0.02em' }} aria-hidden="true">workmark</span>
      </Link>

      <div style={{ width: '100%', maxWidth: 540 }}>
        {/* Progress */}
        <div role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={2} aria-label={`Step ${step} of 2`} style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 24 }}>
          {[1, 2].map((n, i) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', flex: n === 1 ? 'none' : 1 }}>
              <div aria-hidden="true" style={{ width: 28, height: 28, background: step >= n ? C.accent : C.surfaceAlt, border: `1px solid ${step >= n ? C.accent : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.mono, fontSize: 11, fontWeight: 700, color: step >= n ? C.bg : C.textFaint, flexShrink: 0 }}>
                {n}
              </div>
              {i === 0 && <div aria-hidden="true" style={{ flex: 1, height: 1, background: step >= 2 ? C.accent : C.border, margin: '0 8px' }} />}
            </div>
          ))}
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 32 }}>
          {step === 1 && (
            <>
              <h1 style={{ fontFamily: F.serif, fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 6 }}>Welcome to Workmark</h1>
              <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 24, lineHeight: 1.6 }}>Tell us who you are to get started.</p>

              <div role="group" aria-label="Account type" className="mob-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                {([
                  { r: 'student', icon: '🎓', desc: 'Apply to projects, earn verified records' },
                  { r: 'company', icon: '🏢', desc: 'Post projects, find CS talent' },
                  { r: 'faculty', icon: '🔬', desc: 'Post research projects for students' },
                ] as { r: Role; icon: string; desc: string }[]).map(({ r, icon, desc }) => (
                  <button key={r} type="button" onClick={() => setRole(r)} aria-pressed={role === r}
                    style={{ padding: '20px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: `1px solid ${role === r ? C.accent : C.border}`, background: role === r ? C.accentHover : C.surfaceAlt, cursor: 'pointer', transition: 'all 0.15s' }}>
                    <span aria-hidden="true" style={{ fontSize: 24 }}>{icon}</span>
                    <span style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 500, color: role === r ? C.accent : C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {r === 'faculty' ? 'Faculty' : r}
                    </span>
                    <span style={{ fontSize: 10, color: C.textFaint, textAlign: 'center', lineHeight: 1.4 }}>{desc}</span>
                  </button>
                ))}
              </div>

              {(role === 'student' || role === 'faculty') && !validateEdu(userEmail) && userEmail && (
                <div role="alert" style={{ background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.3)', padding: '10px 14px', fontSize: 13, color: '#fbbf24', marginBottom: 16, lineHeight: 1.5 }}>
                  Your email <strong>{userEmail}</strong> is not a .edu address. {role === 'faculty' ? 'Faculty' : 'Student'} accounts require a university email.
                </div>
              )}

              {(() => {
                const eduRequired = (role === 'student' || role === 'faculty') && !!userEmail && !validateEdu(userEmail)
                const disabled = !role || eduRequired
                return (
                  <button type="button" disabled={disabled} onClick={() => setStep(2)}
                    style={{ width: '100%', padding: '12px 0', background: disabled ? C.surfaceAlt : C.accent, color: disabled ? C.textFaint : C.bg, fontFamily: F.mono, fontSize: 13, fontWeight: 500, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em', transition: 'all 0.2s' }}>
                    Continue →
                  </button>
                )
              })()}
            </>
          )}

          {step === 2 && role && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <button type="button" onClick={() => setStep(1)} style={{ fontSize: 12, fontFamily: F.mono, color: C.textFaint, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  ← Back
                </button>
                <h2 style={{ fontFamily: F.serif, fontSize: 20, fontWeight: 700, color: C.text }}>
                  {role === 'student' ? 'Your profile' : role === 'faculty' ? 'Faculty profile' : 'Company profile'}
                </h2>
              </div>

              {role === 'student' ? (
                <StudentForm onSubmit={handleStudentSubmit} loading={loading} emailDomain={emailDomain} />
              ) : role === 'faculty' ? (
                <FacultyForm onSubmit={handleFacultySubmit} loading={loading} email={userEmail} />
              ) : (
                <CompanyForm onSubmit={handleCompanySubmit} loading={loading} />
              )}
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
