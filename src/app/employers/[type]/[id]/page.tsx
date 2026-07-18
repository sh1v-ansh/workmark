import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Wordmark } from '@/app/landing/Wordmark'
import { C, F } from '@/app/landing/tokens'

interface Props {
  params: Promise<{ type: 'company' | 'faculty'; id: string }>
}

export default async function EmployerProfilePage({ params }: Props) {
  const { type, id } = await params
  if (type !== 'company' && type !== 'faculty') notFound()

  const supabase = await createClient()

  const [{ data: profile }, { data: aggregate }, { data: openProjects }] = await Promise.all([
    type === 'company'
      ? supabase.from('companies').select('company_name, industry, hq_location, website, company_size').eq('id', id).maybeSingle()
      : supabase.from('faculty').select('full_name, institution, department, title').eq('id', id).maybeSingle(),
    supabase.from('employer_profiles').select('*').eq('poster_id', id).maybeSingle(),
    supabase.from('projects').select('id, title, type, work_mode, compensation, created_at').eq('poster_id', id).eq('poster_type', type).eq('is_open', true).order('created_at', { ascending: false }).limit(6),
  ])

  if (!profile) notFound()

  const name = type === 'company'
    ? (profile as { company_name: string | null }).company_name
    : (profile as { full_name: string | null }).full_name
  const subtitle = type === 'company'
    ? [(profile as { industry: string | null }).industry, (profile as { hq_location: string | null }).hq_location].filter(Boolean).join(' · ')
    : [(profile as { title: string | null }).title, (profile as { department: string | null }).department, (profile as { institution: string | null }).institution].filter(Boolean).join(' · ')

  return (
    <main style={{ minHeight: '100vh', background: C.bg, color: C.text }}>
      <header style={{ borderBottom: `1px solid ${C.border}`, padding: '20px 24px' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <Wordmark height={30} />
        </Link>
      </header>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '48px 24px' }}>
        <p style={{ fontFamily: F.mono, fontSize: 11, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
          {type === 'company' ? 'Employer profile' : 'Faculty profile'}
        </p>
        <h1 style={{ fontFamily: F.serif, fontSize: 44, fontWeight: 800, color: C.text, marginBottom: 6, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
          {name ?? 'Unnamed'}
        </h1>
        <p style={{ fontSize: 15, color: C.textMuted, fontFamily: F.sans }}>{subtitle}</p>

        {/* Aggregate stats */}
        <section style={{ marginTop: 48, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }} className="mob-2col">
          <Stat label="Engagements" value={aggregate?.engagements_completed?.toString() ?? '0'} />
          <Stat label="Attestation rate" value={aggregate?.attestation_completion_rate != null ? `${Math.round(aggregate.attestation_completion_rate * 100)}%` : '—'} />
          <Stat label="Avg. complexity" value={aggregate?.average_complexity != null ? `${Math.round(aggregate.average_complexity)}` : '—'} />
          <Stat label="Would engage rate" value={aggregate?.repeat_engagement_rate != null ? `${Math.round(aggregate.repeat_engagement_rate * 100)}%` : '—'} />
        </section>

        {/* Open projects */}
        <section style={{ marginTop: 48 }}>
          <h2 style={{ fontFamily: F.mono, fontSize: 12, color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>Open projects</h2>
          {(openProjects?.length ?? 0) === 0 ? (
            <p style={{ fontSize: 13, color: C.textMuted }}>No open projects right now.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }} className="mob-1col">
              {openProjects!.map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`}
                  style={{ display: 'block', background: C.surface, border: `1px solid ${C.border}`, padding: 20, textDecoration: 'none' }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 4 }}>{p.title}</p>
                  <p style={{ fontSize: 11, color: C.textMuted, fontFamily: F.mono }}>{p.type} · {p.work_mode}{p.compensation ? ` · ${p.compensation}` : ''}</p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, padding: 20, borderRadius: 8 }}>
      <p style={{ fontFamily: F.serif, fontSize: 32, fontWeight: 700, color: C.accent, marginBottom: 4, letterSpacing: '-0.01em' }}>{value}</p>
      <p style={{ fontSize: 11, color: C.textMuted, fontFamily: F.mono, letterSpacing: '0.05em' }}>{label}</p>
    </div>
  )
}
