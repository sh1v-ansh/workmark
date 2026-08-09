import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import GithubScanClient from './GithubScanClient'

/**
 * Minimal, standalone verification page for the Phase 1 scan pipeline —
 * deliberately NOT integrated into the main student dashboard, which
 * still runs on pre-rebuild types and is due for a full rewrite in
 * Phase 2+. This page only needs to prove the pipeline works end to end;
 * the polished version of this data belongs on /me (Phase 7).
 */
export default async function GithubScanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: student } = await supabase.from('students').select('id, full_name').eq('id', user.id).maybeSingle()
  if (!student) redirect('/onboarding')

  const [{ data: connection }, { data: grants }, { data: priors }, { data: evidence }] = await Promise.all([
    supabase.from('github_connections').select('*').eq('student_id', user.id).maybeSingle(),
    supabase.from('github_repo_grants').select('*').eq('student_id', user.id).is('revoked_at', null).order('granted_at', { ascending: false }),
    supabase.from('skill_priors').select('*, skills(canonical_name)').eq('student_id', user.id).order('extracted_at', { ascending: false }),
    supabase.from('current_skill_evidence').select('*, skills(canonical_name)').eq('student_id', user.id).order('created_at', { ascending: false }),
  ])

  return (
    <GithubScanClient
      studentName={student.full_name}
      connection={connection}
      grants={grants ?? []}
      priors={priors ?? []}
      evidence={evidence ?? []}
    />
  )
}
