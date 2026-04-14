'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import Link from 'next/link'

type Role = 'student' | 'company'
type Step = 1 | 2

// ─── helpers ──────────────────────────────────────────────────────────────────

function TagInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  const [input, setInput] = useState('')

  function add() {
    const trimmed = input.trim()
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed])
    }
    setInput('')
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              add()
            }
          }}
          placeholder={placeholder ?? 'Add and press Enter'}
          className="flex-1 px-3.5 py-2 rounded-xl border border-gray-300 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        />
        <button
          type="button"
          onClick={add}
          className="px-3 py-2 text-sm font-medium text-brand-700 bg-brand-50 rounded-xl hover:bg-brand-100 transition-colors"
        >
          Add
        </button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-gray-100 text-sm text-gray-700"
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(value.filter((t) => t !== tag))}
                className="text-gray-400 hover:text-red-500"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── student form ─────────────────────────────────────────────────────────────

function StudentForm({
  onSubmit,
  loading,
  emailDomain,
}: {
  onSubmit: (data: Record<string, unknown>) => void
  loading: boolean
  emailDomain: string
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
      full_name: fullName,
      university,
      major,
      degree_type: degreeType,
      graduation_year: graduationYear ? parseInt(graduationYear) : null,
      gpa: gpa ? parseFloat(gpa) : null,
      is_international: isInternational,
      visa_type: isInternational ? visaType : null,
      skills,
      github_url: githubUrl || null,
      linkedin_url: linkedinUrl || null,
      availability,
      hours_per_week: hoursPerWeek ? parseInt(hoursPerWeek) : null,
      available_from: availableFrom || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Full name <span className="text-red-500">*</span>
          </label>
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            placeholder="Jane Smith"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            University <span className="text-red-500">*</span>
          </label>
          <input
            required
            value={university}
            onChange={(e) => setUniversity(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            placeholder="MIT"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Major</label>
          <input
            value={major}
            onChange={(e) => setMajor(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            placeholder="Computer Science"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Degree</label>
          <select
            value={degreeType}
            onChange={(e) => setDegreeType(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          >
            <option value="BS">BS</option>
            <option value="MS">MS</option>
            <option value="PhD">PhD</option>
            <option value="BA">BA</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Graduation year</label>
          <input
            type="number"
            min={2024}
            max={2035}
            value={graduationYear}
            onChange={(e) => setGraduationYear(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            placeholder="2026"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">GPA</label>
          <input
            type="number"
            min={0}
            max={4}
            step={0.01}
            value={gpa}
            onChange={(e) => setGpa(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            placeholder="3.80"
          />
        </div>
      </div>

      <TagInput
        label="Skills (press Enter to add)"
        value={skills}
        onChange={setSkills}
        placeholder="e.g. Python, React, SQL"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">GitHub URL</label>
          <input
            type="url"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            placeholder="https://github.com/you"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">LinkedIn URL</label>
          <input
            type="url"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            placeholder="https://linkedin.com/in/you"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Availability</label>
          <select
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          >
            <option value="full-time">Full-time</option>
            <option value="part-time">Part-time</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Hours per week</label>
          <input
            type="number"
            min={1}
            max={60}
            value={hoursPerWeek}
            onChange={(e) => setHoursPerWeek(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            placeholder="20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Available from</label>
          <input
            type="date"
            value={availableFrom}
            onChange={(e) => setAvailableFrom(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* International student */}
      <div className="rounded-xl border border-gray-200 p-4 space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isInternational}
            onChange={(e) => setIsInternational(e.target.checked)}
            className="w-4 h-4 accent-brand-600 rounded"
          />
          <span className="text-sm font-medium text-gray-700">
            I am an international student
          </span>
        </label>
        {isInternational && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Visa / work auth type
            </label>
            <select
              value={visaType}
              onChange={(e) => setVisaType(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            >
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

      {/* Email note */}
      {emailDomain && (
        <p className="text-xs text-gray-400">
          Signing up with <strong>{emailDomain}</strong>
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Saving profile…
          </span>
        ) : (
          'Complete profile'
        )}
      </button>
    </form>
  )
}

// ─── company form ─────────────────────────────────────────────────────────────

function CompanyForm({
  onSubmit,
  loading,
}: {
  onSubmit: (data: Record<string, unknown>) => void
  loading: boolean
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
    onSubmit({
      company_name: companyName,
      website: website || null,
      industry: industry || null,
      company_size: companySize,
      hq_location: hqLocation || null,
      contact_name: contactName,
      contact_email: contactEmail,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Company name <span className="text-red-500">*</span>
        </label>
        <input
          required
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          placeholder="Acme Inc."
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Website</label>
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            placeholder="https://acme.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Industry</label>
          <input
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            placeholder="Software, Fintech, Healthcare…"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Company size</label>
          <select
            value={companySize}
            onChange={(e) => setCompanySize(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          >
            <option value="1-10">1–10</option>
            <option value="11-50">11–50</option>
            <option value="51-200">51–200</option>
            <option value="200+">200+</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">HQ location</label>
          <input
            value={hqLocation}
            onChange={(e) => setHqLocation(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            placeholder="San Francisco, CA"
          />
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
          Primary contact
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Contact name <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              placeholder="Jane Smith"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Contact email <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              placeholder="jane@acme.com"
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors mt-2"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Saving…
          </span>
        ) : (
          'Complete profile'
        )}
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
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      setUserId(user.id)
      setUserEmail(user.email ?? '')

      // Pre-select role from metadata if set during sign-up
      const metaRole = user.user_metadata?.role as Role | undefined
      if (metaRole) {
        setRole(metaRole)
        setStep(2)
      }
    }
    loadUser()
  }, [router])

  async function handleStudentSubmit(data: Record<string, unknown>) {
    if (!userId) return
    setLoading(true)
    const supabase = createClient()

    try {
      const { error } = await supabase.from('students').insert({
        id: userId,
        ...data,
      })

      if (error) throw error

      toast('Profile saved! Welcome to Workmark.', 'success')
      router.push('/student/dashboard')
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save profile.'
      toast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleCompanySubmit(data: Record<string, unknown>) {
    if (!userId) return
    setLoading(true)
    const supabase = createClient()

    try {
      const { error } = await supabase.from('companies').insert({
        id: userId,
        ...data,
      })

      if (error) throw error

      toast('Company profile saved! Welcome to Workmark.', 'success')
      router.push('/company/dashboard')
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save profile.'
      toast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }

  const emailDomain = userEmail ? `@${userEmail.split('@')[1]}` : ''

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4">
      {/* Logo */}
      <Link href="/" className="mb-8">
        <span className="text-2xl font-bold tracking-tight text-gray-900">
          Work<span className="text-brand-600">mark</span>
        </span>
      </Link>

      <div className="w-full max-w-xl">
        {/* Progress indicator */}
        <div className="flex items-center gap-2 mb-6">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              step >= 1
                ? 'bg-brand-600 text-white'
                : 'bg-gray-200 text-gray-500'
            }`}
          >
            1
          </div>
          <div
            className={`flex-1 h-0.5 transition-colors ${
              step >= 2 ? 'bg-brand-600' : 'bg-gray-200'
            }`}
          />
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              step >= 2
                ? 'bg-brand-600 text-white'
                : 'bg-gray-200 text-gray-500'
            }`}
          >
            2
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          {step === 1 && (
            <>
              <h1 className="text-xl font-bold text-gray-900 mb-1">
                Welcome to Workmark
              </h1>
              <p className="text-sm text-gray-500 mb-6">
                Tell us who you are to get started.
              </p>

              <div className="grid grid-cols-2 gap-3">
                {(['student', 'company'] as Role[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={`flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-all ${
                      role === r
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-3xl">
                      {r === 'student' ? '🎓' : '🏢'}
                    </span>
                    <span
                      className={`text-sm font-semibold capitalize ${
                        role === r ? 'text-brand-700' : 'text-gray-700'
                      }`}
                    >
                      {r}
                    </span>
                    <span className="text-xs text-gray-400 text-center">
                      {r === 'student'
                        ? 'Apply to projects, earn verified records'
                        : 'Post projects, find CS talent'}
                    </span>
                  </button>
                ))}
              </div>

              {role === 'student' && !validateEdu(userEmail) && userEmail && (
                <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                  Your email <strong>{userEmail}</strong> is not a .edu address.
                  Student accounts require a university email.
                </div>
              )}

              <button
                disabled={
                  !role ||
                  (role === 'student' && !validateEdu(userEmail) && !!userEmail)
                }
                onClick={() => setStep(2)}
                className="mt-6 w-full py-3 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Continue →
              </button>
            </>
          )}

          {step === 2 && role && (
            <>
              <div className="flex items-center gap-2 mb-5">
                <button
                  onClick={() => setStep(1)}
                  className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
                >
                  ← Back
                </button>
                <h1 className="text-xl font-bold text-gray-900">
                  {role === 'student' ? 'Your profile' : 'Company profile'}
                </h1>
              </div>

              {role === 'student' ? (
                <StudentForm
                  onSubmit={handleStudentSubmit}
                  loading={loading}
                  emailDomain={emailDomain}
                />
              ) : (
                <CompanyForm onSubmit={handleCompanySubmit} loading={loading} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function validateEdu(email: string): boolean {
  return email.toLowerCase().endsWith('.edu')
}
