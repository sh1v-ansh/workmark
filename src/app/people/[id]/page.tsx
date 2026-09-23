import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { loadStudentRecord } from '@/lib/profile/record'
import { publicEngagements } from '@/lib/profile/visibility'
import { loadInviteContext } from '@/lib/listings/people'
import PublicProfileClient from '@/app/p/[handle]/PublicProfileClient'

export const metadata = { title: 'Profile' }

/**
 * A student's profile, opened from the People tab on Find work.
 *
 * /p/[handle] is the public, shareable version and needs a claimed handle.
 * This one works for anybody who chose to be found, handle or not, and only
 * for signed-in viewers: the directory policy decides whether the row can be
 * read at all, so a student who has not opted in is simply not found.
 */
export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: visible } = await supabase
    .from('students')
    .select('id, open_to_collab')
    .eq('id', id)
    .maybeSingle()
  // Visible through the directory policy, or it is the viewer's own row.
  if (!visible || (!visible.open_to_collab && id !== user.id)) notFound()

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const [record, invite] = await Promise.all([
    loadStudentRecord(admin, id),
    loadInviteContext(supabase, admin, user.id, id),
  ])
  if (!record) notFound()

  return (
    <PublicProfileClient
      studentId={id}
      student={record.student}
      skills={record.skills.map((s) => ({ skillId: s.skillId, name: s.name, bestLevel: s.bestLevel, artifactCount: s.artifactCount }))}
      engagements={publicEngagements(record.engagements)}
      trackRecord={record.trackRecord}
      isOwner={user.id === id}
      signedIn
      invite={invite}
    />
  )
}
