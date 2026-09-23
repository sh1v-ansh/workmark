import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NewListingClient from '../../new/NewListingClient'
import { getListingRequirements } from '@/lib/matching/listing'

export const metadata = { title: 'Edit' }

const text = (n: number | null) => (n == null ? '' : String(n))

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: listing } = await supabase
    .from('listings')
    .select('id, poster_id, title, brief, est_hours, hours_per_week, duration, work_mode, team_size, declared_difficulty')
    .eq('id', id)
    .maybeSingle()
  if (!listing) notFound()
  if (listing.poster_id !== user.id) redirect(`/listings/${id}`)

  const [requirements, { data: taxonomy }] = await Promise.all([
    getListingRequirements(supabase, [id]).then((m) => m.get(id) ?? []),
    supabase.from('skills').select('id, canonical_name, parent_id').is('deprecated_at', null).order('canonical_name'),
  ])

  return (
    <NewListingClient
      taxonomy={taxonomy ?? []}
      agentsAvailable={false}
      editing={{
        id,
        initial: {
          title: listing.title ?? '',
          brief: listing.brief ?? '',
          requirements: requirements.map((r) => ({
            skillId: r.skillId,
            canonicalName: r.canonicalName ?? r.skillId,
            requiredLevel: r.requiredLevel,
          })),
          hoursPerWeek: text(listing.hours_per_week),
          estHours: text(listing.est_hours),
          duration: listing.duration ?? '',
          workMode: listing.work_mode ?? 'remote',
          teamSize: text(listing.team_size),
          difficulty: text(listing.declared_difficulty),
        },
      }}
    />
  )
}
