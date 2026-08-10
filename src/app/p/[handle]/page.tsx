import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { loadStudentRecord } from '@/lib/profile/record'
import { publicEngagements } from '@/lib/profile/visibility'
import PublicProfileClient from './PublicProfileClient'

/**
 * /p/[handle] — the public, shareable verified record.
 *
 * Readable by anyone, signed in or not. Loaded via service-role because
 * a public viewer has no RLS grant on skill_evidence, and the filtering
 * that matters here is per-engagement visibility, which is partly
 * field-level (redacted keeps the row, drops the poster and
 * description) and therefore not expressible as a policy. Doing it in
 * one code path beats splitting it between policies and code.
 *
 * The service-role client is scoped to exactly one student, resolved
 * from a handle that only exists because that student claimed it.
 */
async function resolveHandle(handle: string) {
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data } = await admin
    .from('students')
    .select('id')
    .eq('handle', handle.toLowerCase())
    .maybeSingle()
  return { admin, studentId: data?.id ?? null }
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params
  const { admin, studentId } = await resolveHandle(handle)
  if (!studentId) return { title: 'Profile not found · Workmark' }

  const { data: student } = await admin.from('students').select('full_name, major, university').eq('id', studentId).maybeSingle()
  const name = student?.full_name ?? 'Student'
  return {
    title: `${name} · Workmark`,
    description: [student?.major, student?.university].filter(Boolean).join(' · ') || 'Verified work record on Workmark.',
  }
}

export default async function PublicProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const { admin, studentId } = await resolveHandle(handle)
  if (!studentId) notFound()

  const record = await loadStudentRecord(admin, studentId)
  if (!record) notFound()

  // Is the viewer the owner? Only affects the "this is your profile"
  // affordance — the data shown is identical either way, so what a
  // student sees here is exactly what everyone else sees.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <PublicProfileClient
      student={record.student}
      skills={record.skills.map((s) => ({ skillId: s.skillId, name: s.name, bestLevel: s.bestLevel, artifactCount: s.artifactCount }))}
      engagements={publicEngagements(record.engagements)}
      trackRecord={record.trackRecord}
      isOwner={user?.id === studentId}
      signedIn={!!user}
    />
  )
}
