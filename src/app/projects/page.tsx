'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import ProjectCard from '@/components/ProjectCard'
import type { Project } from '@/lib/types'
import Link from 'next/link'

// ─── filter types ──────────────────────────────────────────────────────────────

interface Filters {
  type: string
  workMode: string
  paid: string       // 'all' | 'paid' | 'unpaid'
  workAuth: string   // 'all' | 'required' | 'not-required'
  skill: string
}

const DEFAULT_FILTERS: Filters = {
  type: 'all',
  workMode: 'all',
  paid: 'all',
  workAuth: 'all',
  skill: '',
}

// ─── page ──────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)

  useEffect(() => {
    async function fetchProjects() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('projects')
        .select('*, companies(company_name, industry, hq_location)')
        .eq('is_open', true)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setProjects(data as Project[])
      }
      setLoading(false)
    }
    fetchProjects()
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
        const allSkills = [
          ...(p.required_skills ?? []),
          ...(p.preferred_skills ?? []),
        ].map((s) => s.toLowerCase())
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

  const hasActiveFilters = Object.entries(filters).some(([k, v]) =>
    k === 'skill' ? !!v : v !== 'all'
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="border-b border-gray-100 bg-white sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg tracking-tight text-gray-900">
            Work<span className="text-brand-600">mark</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium text-white bg-brand-600 px-3.5 py-1.5 rounded-lg hover:bg-brand-700 transition-colors"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Hero */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Open Projects &amp; Internships
          </h1>
          <p className="text-gray-500">
            {loading
              ? 'Loading…'
              : `${filtered.length} of ${projects.length} positions`}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* ── Filters sidebar ── */}
          <aside className="w-full lg:w-56 shrink-0">
            <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-5 sticky top-20">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">Filters</span>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-xs text-brand-600 hover:underline"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Type */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Type
                </p>
                {['all', 'internship', 'project', 'part-time'].map((t) => (
                  <label key={t} className="flex items-center gap-2 py-1 cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      value={t}
                      checked={filters.type === t}
                      onChange={() => update('type', t)}
                      className="accent-brand-600"
                    />
                    <span className="text-sm text-gray-700 capitalize">
                      {t === 'all' ? 'All types' : t}
                    </span>
                  </label>
                ))}
              </div>

              {/* Work mode */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Work mode
                </p>
                {['all', 'remote', 'hybrid', 'onsite'].map((m) => (
                  <label key={m} className="flex items-center gap-2 py-1 cursor-pointer">
                    <input
                      type="radio"
                      name="workMode"
                      value={m}
                      checked={filters.workMode === m}
                      onChange={() => update('workMode', m)}
                      className="accent-brand-600"
                    />
                    <span className="text-sm text-gray-700 capitalize">
                      {m === 'all' ? 'All modes' : m}
                    </span>
                  </label>
                ))}
              </div>

              {/* Paid */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Compensation
                </p>
                {[
                  { value: 'all', label: 'All' },
                  { value: 'paid', label: 'Paid only' },
                  { value: 'unpaid', label: 'Unpaid only' },
                ].map(({ value, label }) => (
                  <label key={value} className="flex items-center gap-2 py-1 cursor-pointer">
                    <input
                      type="radio"
                      name="paid"
                      value={value}
                      checked={filters.paid === value}
                      onChange={() => update('paid', value)}
                      className="accent-brand-600"
                    />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>

              {/* Work auth */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Work auth
                </p>
                {[
                  { value: 'all', label: 'All' },
                  { value: 'not-required', label: 'Open to all' },
                  { value: 'required', label: 'US auth only' },
                ].map(({ value, label }) => (
                  <label key={value} className="flex items-center gap-2 py-1 cursor-pointer">
                    <input
                      type="radio"
                      name="workAuth"
                      value={value}
                      checked={filters.workAuth === value}
                      onChange={() => update('workAuth', value)}
                      className="accent-brand-600"
                    />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>

              {/* Skill search */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Skill
                </p>
                <input
                  type="text"
                  value={filters.skill}
                  onChange={(e) => update('skill', e.target.value)}
                  placeholder="e.g. Python, React"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>
            </div>
          </aside>

          {/* ── Project grid ── */}
          <div className="flex-1">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="h-52 rounded-2xl bg-gray-100 animate-pulse"
                  />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-lg mb-1">No projects match your filters</p>
                <button
                  onClick={clearFilters}
                  className="text-sm text-brand-600 hover:underline"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
