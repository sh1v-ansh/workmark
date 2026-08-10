import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EngagementClient, { type EngagementData } from './EngagementClient'
import type { Stage } from '@/lib/engagements/lifecycle'

export default async function EngagementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Participants-only RLS on engagements means a non-participant simply
  // gets nothing back — no separate membership check needed here.
  const { data: engagement } = await supabase
    .from('engagements')
    .select('*, listings(title, brief)')
    .eq('id', id)
    .maybeSingle()
  if (!engagement) notFound()

  const isStudent = engagement.student_id === user.id
  const counterpartId = isStudent ? engagement.poster_id : engagement.student_id

  const [{ data: me }, { data: counterpart }, { data: outcome }, { data: contact }, { data: evidenceRows }] =
    await Promise.all([
      supabase.from('students').select('full_name').eq('id', user.id).maybeSingle(),
      supabase.from('students').select('full_name, github_username').eq('id', counterpartId).maybeSingle(),
      supabase.from('outcomes').select('*').eq('engagement_id', id).maybeSingle(),
      supabase.from('contact_shares').select('student_email, poster_email').eq('application_id', engagement.application_id).maybeSingle(),
      supabase.from('current_skill_evidence').select('skill_id, difficulty_cleared').eq('engagement_id', id),
    ])

  // Repos the student can offer for close-out: granted, scan-enabled,
  // not revoked. The poster picks from this list, so the student's
  // per-repo consent still governs even though the poster acts.
  let scannableRepos: string[] = []
  if (engagement.stage === 'submitted' || engagement.stage === 'in_progress') {
    const { data: grants } = await supabase
      .from('github_repo_grants')
      .select('repo_full_name')
      .eq('student_id', engagement.student_id)
      .eq('scan_enabled', true)
      .is('revoked_at', null)
      .order('repo_full_name')
    scannableRepos = (grants ?? []).map((g) => g.repo_full_name)
  }

  const skillIds = Array.from(new Set((evidenceRows ?? []).map((r) => r.skill_id)))
  const { data: skillRows } = skillIds.length
    ? await supabase.from('skills').select('id, canonical_name').in('id', skillIds)
    : { data: [] as { id: string; canonical_name: string }[] }
  const nameById = new Map((skillRows ?? []).map((s) => [s.id, s.canonical_name]))

  const listing = engagement.listings as unknown as { title: string | null; brief: string | null } | null

  const data: EngagementData = {
    id: engagement.id,
    listingId: engagement.listing_id,
    listingTitle: listing?.title ?? 'Untitled project',
    listingBrief: listing?.brief ?? null,
    stage: engagement.stage as Stage,
    description: engagement.description,
    agreedByStudentAt: engagement.description_agreed_by_student_at,
    agreedByPosterAt: engagement.description_agreed_by_poster_at,
    visibility: engagement.visibility,
    openedAt: engagement.opened_at,
    submittedAt: engagement.submitted_at,
    closedAt: engagement.closed_at,
    abandonedAt: engagement.abandoned_at,
    role: isStudent ? 'student' : 'poster',
    myName: me?.full_name ?? null,
    counterpartName: counterpart?.full_name ?? null,
    counterpartGithub: counterpart?.github_username ?? null,
    counterpartEmail: (isStudent ? contact?.poster_email : contact?.student_email) ?? null,
    scannableRepos,
    evidence: skillIds.map((sid) => ({
      skillId: sid,
      name: nameById.get(sid) ?? sid,
      level: Math.max(...(evidenceRows ?? []).filter((r) => r.skill_id === sid).map((r) => r.difficulty_cleared)),
    })),
    outcome: outcome
      ? {
          posterSatisfaction: outcome.poster_satisfaction,
          wouldRehire: outcome.would_rehire,
          hiredBeyondEngagement: outcome.hired_beyond_engagement,
        }
      : null,
  }

  return <EngagementClient data={data} />
}
