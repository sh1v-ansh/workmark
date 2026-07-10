'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import ProjectCard from '@/components/ProjectCard'
import Navbar from '@/components/Navbar'
import { C, F } from '@/lib/theme/dark-tokens'
import { LogoMark } from '@/app/landing/LogoMark'
import type { Project } from '@/lib/types'
import Link from 'next/link'

interface Filters {
  type: string
  workMode: string
  paid: string
  workAuth: string
  skill: string
}

const DEFAULT_FILTERS: Filters = {
  type: 'all',
  workMode: 'all',
  paid: 'all',
  workAuth: 'all',
  skill: '',
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [userRole, setUserRole] = useState<'student' | 'company' | null>(null)
  const [userName, setUserName] = useState<string | undefined>(undefined)

  useEffect(() => {
    async function init() {
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const role = user.user_metadata?.role as 'student' | 'company' | undefined
        setUserRole(role ?? null)
        if (role === 'student') {
          const { data } = await supabase.from('students').select('full_name').eq('id', user.id).single()
          setUserName(data?.full_name ?? undefined)
        } else if (role === 'company') {
          const { data } = await supabase.from('companies').select('company_name').eq('id', user.id).single()
          setUserName(data?.company_name ?? undefined)
        }
      }

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('is_open', true)
        .order('created_at', { ascending: false })

      if (!error && data) setProjects(data as Project[])
      setLoading(false)
    }
    init()
  }, [])

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (filters.type !== 'all' && p.type !== filters.type) return false
      if (filters.workMode !== 'all' && p.work_mode !== filters.workMode) return false
      if (filters.paid === 'paid' && !p.is_paid) return false
      if (filters.paid === 'unpaid' && p.is_paid) return false
      if (filters.workAuth === 'required' && !p.work_auth_required) return false
      if (filters.workAuth === 'not-required' && p.work_auth_required) return false
      if (filters.skill) {
        const skillLower = filters.skill.toLowerCase()
        const allSkills = [...(p.required_skills ?? []), ...(p.preferred_skills ?? [])].map((s) => s.toLowerCase())
        if (!allSkills.some((s) => s.includes(skillLower))) return false
      }
      return true
    })
  }, [projects, filters])

  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  function clearFilters() {
    setFilters(DEFAULT_FILTERS)
  }

  const hasActiveFilters = Object.entries(filters).some(([k, v]) => k === 'skill' ? !!v : v !== 'all')

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {userRole ? (
        <Navbar role={userRole} userName={userName} />
      ) : (
        <header style={{ borderBottom: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', position: 'sticky', top: 0, zIndex: 40 }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link href="/" aria-label="Workmark home" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
              <LogoMark size={18} />
              <span style={{ fontFamily: F.serif, fontSize: 18, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>workmark</span>
            </Link>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Link href="/login" style={{ fontFamily: F.mono, fontSize: 12, color: C.textMuted, textDecoration: 'none', letterSpacing: '0.04em' }}>
                Sign in
              </Link>
              <Link href="/login" style={{ fontFamily: F.mono, fontSize: 12, color: C.bg, background: C.accent, padding: '6px 14px', textDecoration: 'none', letterSpacing: '0.04em' }}>
                Sign up
              </Link>
            </div>
          </div>
        </header>
      )}

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: F.serif, fontSize: 26, fontWeight: 700, color: C.text, marginBottom: 6 }}>
            Open Projects &amp; Internships
          </h1>
          <p style={{ fontFamily: F.mono, fontSize: 12, color: C.textFaint }}>
            {loading ? 'Loading…' : `${filtered.length} of ${projects.length} positions`}
          </p>
        </div>

        <div className="mob-col" style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>
          {/* Filter sidebar */}
          <aside className="mob-static mob-w100" style={{ width: 200, flexShrink: 0, position: 'sticky', top: 72 }}>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <span style={{ fontFamily: F.mono, fontSize: 11, color: C.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Filters</span>
                {hasActiveFilters && (
                  <button onClick={clearFilters} style={{ fontFamily: F.mono, fontSize: 10, color: C.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0, letterSpacing: '0.04em' }}>
                    Clear
                  </button>
                )}
              </div>

              <FilterGroup label="Type">
                {['all', 'internship', 'project', 'part-time'].map((t) => (
                  <RadioItem key={t} name="type" value={t} checked={filters.type === t} onChange={() => update('type', t)}
                    label={t === 'all' ? 'All types' : t.charAt(0).toUpperCase() + t.slice(1)} />
                ))}
              </FilterGroup>

              <FilterGroup label="Work mode">
                {['all', 'remote', 'hybrid', 'onsite'].map((m) => (
                  <RadioItem key={m} name="workMode" value={m} checked={filters.workMode === m} onChange={() => update('workMode', m)}
                    label={m === 'all' ? 'All modes' : m.charAt(0).toUpperCase() + m.slice(1)} />
                ))}
              </FilterGroup>

              <FilterGroup label="Compensation">
                {[{ value: 'all', label: 'All' }, { value: 'paid', label: 'Paid only' }, { value: 'unpaid', label: 'Unpaid only' }].map(({ value, label }) => (
                  <RadioItem key={value} name="paid" value={value} checked={filters.paid === value} onChange={() => update('paid', value)} label={label} />
                ))}
              </FilterGroup>

              <FilterGroup label="Work auth">
                {[{ value: 'all', label: 'All' }, { value: 'not-required', label: 'Open to all' }, { value: 'required', label: 'US auth only' }].map(({ value, label }) => (
                  <RadioItem key={value} name="workAuth" value={value} checked={filters.workAuth === value} onChange={() => update('workAuth', value)} label={label} />
                ))}
              </FilterGroup>

              <FilterGroup label="Skill" last>
                <input
                  type="text"
                  value={filters.skill}
                  onChange={(e) => update('skill', e.target.value)}
                  placeholder="e.g. Python, React"
                  className="dk-input"
                  style={{ fontSize: 12 }}
                />
              </FilterGroup>
            </div>
          </aside>

          {/* Project grid */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {loading ? (
              <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {[...Array(6)].map((_, i) => (
                  <div key={i} style={{ height: 200, background: C.surface, border: `1px solid ${C.border}`, opacity: 0.5 }} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px 0', color: C.textFaint }}>
                <p style={{ fontSize: 14, marginBottom: 12 }}>No projects match your filters</p>
                <button onClick={clearFilters} style={{ fontFamily: F.mono, fontSize: 12, color: C.accent, background: 'none', border: 'none', cursor: 'pointer' }}>
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {filtered.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

function FilterGroup({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ marginBottom: last ? 0 : 18 }}>
      <p style={{ fontFamily: F.mono, fontSize: 9, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</p>
      {children}
    </div>
  )
}

function RadioItem({ name, value, checked, onChange, label }: { name: string; value: string; checked: boolean; onChange: () => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', cursor: 'pointer' }}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} style={{ accentColor: C.accent, width: 12, height: 12 }} />
      <span style={{ fontFamily: F.mono, fontSize: 11, color: checked ? C.textSub : C.textFaint }}>{label}</span>
    </label>
  )
}
