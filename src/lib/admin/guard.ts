// One place that decides whether someone may see an admin page.
//
// Repeated in every admin page rather than once in middleware on purpose:
// middleware runs on the edge without a database round trip, so it can tell
// whether someone is signed in but not what they are. The role check has to
// happen where the database is, and a guard that lives in one file is a
// guard nobody forgets to call.

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import { getAccount, hasRole } from '@/lib/auth/roles'

export interface AdminContext {
  adminId: string
  /** Service-role client. Admin pages read across every student by design. */
  admin: SupabaseClient
}

/**
 * notFound() rather than a redirect or a 403 page: an admin surface
 * shouldn't confirm to a stranger that it exists. Someone poking at /admin
 * gets exactly what they'd get for any other URL that isn't a page.
 */
export async function requireAdmin(): Promise<AdminContext> {
  const supabase = await createClient()
  const account = await getAccount(supabase)
  if (!hasRole(account, 'admin')) notFound()

  return {
    adminId: account!.id,
    admin: createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    ),
  }
}
