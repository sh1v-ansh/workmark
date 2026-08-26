import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getAccount, hasRole } from '@/lib/auth/roles'
import { loadQueue, countsByKind } from '@/lib/admin/queue'
import AdminQueueClient from './AdminQueueClient'

/**
 * /admin — everything waiting on a person.
 *
 * Six features write data intended for a human to act on and none of them
 * had anywhere to be seen: work submitted for review reached a CLI script,
 * disputes needing a person reached nothing at all despite a 30-day
 * statutory clock, unmatched skills were dropped, failed scans told nobody.
 *
 * notFound() rather than a redirect for a non-admin: an admin surface
 * shouldn't confirm to a stranger that it exists.
 */
export default async function AdminPage() {
  const supabase = await createClient()
  const account = await getAccount(supabase)
  if (!hasRole(account, 'admin')) notFound()

  // The queue reads across every student's data, which no user-scoped
  // policy grants — correctly, since that's the whole point of the role.
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const [{ items, failedSources }, { data: taxonomy }] = await Promise.all([
    loadQueue(admin),
    // For the "map this name to a skill" picker.
    admin.from('skills').select('id, canonical_name').is('deprecated_at', null).order('canonical_name'),
  ])

  return (
    <AdminQueueClient
      items={items}
      counts={countsByKind(items)}
      failedSources={failedSources}
      taxonomy={(taxonomy ?? []).map((s) => ({ id: s.id, name: s.canonical_name }))}
    />
  )
}
