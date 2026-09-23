import type { SupabaseClient } from '@supabase/supabase-js'
import type { EventName, EventProps } from './events'
import { cleanProps } from './events'

/**
 * Record an event from the server.
 *
 * For the things a browser cannot honestly report: a scan finishing, the
 * first piece of evidence landing, an engagement closing. Those happen in a
 * worker with nobody watching, and a client-side track() would only ever
 * catch the ones where somebody had the tab open.
 *
 * Same rule as the client half — it never throws. An analytics write must
 * not be able to fail a scan, so the failure is logged and swallowed. The
 * caller does not await a result it could do anything with.
 */
export async function record(
  admin: SupabaseClient,
  name: EventName,
  studentId: string | null,
  props: EventProps = {},
): Promise<void> {
  try {
    const { error } = await admin.from('events').insert({
      student_id: studentId,
      session_id: null,
      name,
      props: cleanProps(props),
    })
    if (error) console.error(`[events] could not record ${name}:`, error.message)
  } catch (err) {
    console.error(`[events] could not record ${name}:`, err instanceof Error ? err.message : err)
  }
}

/**
 * Record something only the first time it happens for a student.
 *
 * `first_evidence` is the event this exists for: it fires from inside the
 * scan loop, which runs once per repository and again on every rescan, so
 * without a check the "students who got their first skill" number would
 * count the same person forty times.
 *
 * A read then a write, which races with itself — two repositories finishing
 * at the same moment can both find nothing and both insert. That is
 * acceptable here and worth stating: the cost is a duplicate row in a table
 * every query already reads with `min(occurred_at) group by student_id`,
 * and the alternative is a unique index on a table whose whole value is
 * being cheap to write to.
 */
export async function recordOnce(
  admin: SupabaseClient,
  name: EventName,
  studentId: string,
  props: EventProps = {},
): Promise<void> {
  try {
    const { data, error } = await admin
      .from('events')
      .select('id')
      .eq('student_id', studentId)
      .eq('name', name)
      .limit(1)

    // A failed read must not become a duplicate write. Skipping loses one
    // event; writing anyway corrupts the count this event exists to produce.
    if (error) {
      console.error(`[events] could not check for ${name}:`, error.message)
      return
    }
    if (data && data.length > 0) return

    await record(admin, name, studentId, props)
  } catch (err) {
    console.error(`[events] could not record ${name}:`, err instanceof Error ? err.message : err)
  }
}
