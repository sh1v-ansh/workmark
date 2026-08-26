import { requireAdmin } from '@/lib/admin/guard'
import { loadQueue, countsByKind } from '@/lib/admin/queue'
import AdminQueueClient from './AdminQueueClient'

/**
 * /admin/queue — everything waiting on a person.
 *
 * Six features write data intended for a human to act on and none of them
 * had anywhere to be seen: work submitted for review reached a CLI script,
 * disputes needing a person reached nothing at all despite a 30-day
 * statutory clock, unmatched skills were dropped, failed scans told nobody.
 */
export default async function AdminQueuePage() {
  const { admin } = await requireAdmin()

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
