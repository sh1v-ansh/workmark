import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import RecordDetailClient from './RecordDetailClient'
import type { VerifiedWorkRecord, Milestone, IssueFlag } from '@/lib/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function RecordDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: record } = await supabase
    .from('verified_work_records')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!record) notFound()

  const isStudent = record.student_id === user.id
  const isPoster = record.poster_id === user.id
  if (!isStudent && !isPoster) notFound()

  // Populate a summary_draft on first read if the poster hasn't filled one yet
  // and neither summary field is set. Draft template per spec §3.2 step 1.
  let summaryDraft = record.summary_draft
  if (!summaryDraft && !record.summary_final) {
    const techs = (record.skills_used ?? []).join(', ')
    summaryDraft = `Completed a ${record.project_title ?? 'project'} engagement${techs ? ` using ${techs}` : ''} with ${record.poster_display_name ?? 'the organization'}.`
    await supabase.from('verified_work_records').update({ summary_draft: summaryDraft }).eq('id', id)
  }

  const [{ data: milestones }, { data: flags }] = await Promise.all([
    supabase.from('milestones').select('*').eq('record_id', id).order('due_date', { ascending: true }),
    supabase.from('issue_flags').select('*').eq('record_id', id).order('created_at', { ascending: false }),
  ])

  const viewerRole: 'student' | 'poster' = isStudent ? 'student' : 'poster'

  return (
    <RecordDetailClient
      record={{ ...record, summary_draft: summaryDraft } as VerifiedWorkRecord}
      milestones={(milestones ?? []) as Milestone[]}
      flags={(flags ?? []) as IssueFlag[]}
      viewerRole={viewerRole}
    />
  )
}
