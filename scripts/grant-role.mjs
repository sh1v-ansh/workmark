// Grant or revoke a role, by email.
//
// A CLI on purpose, and it should stay one. Admin is never self-serve: no
// signup path can produce one, and the API route narrows the role it accepts
// so a request can never ask for it. That leaves exactly one way in, which
// is somebody with the service key running this deliberately.
//
// It's also the bootstrap — before this runs there are no admins at all, so
// there is nobody who could grant the first one through the product.
//
// Usage:
//   node --env-file=.env.local scripts/grant-role.mjs list
//   node --env-file=.env.local scripts/grant-role.mjs grant  someone@university.edu admin
//   node --env-file=.env.local scripts/grant-role.mjs revoke someone@university.edu admin

import { createClient } from '@supabase/supabase-js'

// Node 20 has no global WebSocket, which supabase-js's realtime client
// demands at construction even when unused. Same polyfill as review-queue.mjs.
if (!globalThis.WebSocket) {
  const { WebSocket } = await import('ws')
  globalThis.WebSocket = WebSocket
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
  process.exit(1)
}

const admin = createClient(url, key)
const VALID = ['student', 'faculty', 'admin']

async function findUserByEmail(email) {
  // No admin.getUserByEmail in supabase-js, so page through the list. Fine
  // at this scale and this is a rare, deliberate operation.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const match = (data.users ?? []).find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (match) return match
    if ((data.users ?? []).length < 200) break
  }
  return null
}

async function list() {
  const { data, error } = await admin
    .from('accounts')
    .select('id, roles, status, faculty_verified_at')
    .order('created_at', { ascending: false })
  if (error) throw error

  const staff = (data ?? []).filter((a) => a.roles.includes('admin') || a.roles.includes('faculty'))
  if (staff.length === 0) {
    console.log('No faculty or admin accounts yet.')
    return
  }
  for (const a of staff) {
    const verified = a.roles.includes('faculty')
      ? a.faculty_verified_at ? ' (faculty verified)' : ' (faculty UNVERIFIED)'
      : ''
    console.log(`${a.id}  ${a.roles.join(', ')}${verified}  ${a.status}`)
  }
}

async function change(email, role, add) {
  if (!VALID.includes(role)) {
    console.error(`Role must be one of: ${VALID.join(', ')}`)
    process.exit(1)
  }

  const user = await findUserByEmail(email)
  if (!user) {
    console.error(`No account with email ${email}. They must sign up first.`)
    process.exit(1)
  }

  const { data: account } = await admin
    .from('accounts')
    .select('roles')
    .eq('id', user.id)
    .maybeSingle()

  const current = account?.roles ?? ['student']
  let next = add
    ? Array.from(new Set([...current, role]))
    : current.filter((r) => r !== role)

  // The check constraint requires at least one role, and an account with
  // none would fail every permission check in a way that reads as a bug
  // rather than a revocation.
  if (next.length === 0) next = ['student']

  const { error } = await admin
    .from('accounts')
    .upsert(
      {
        id: user.id,
        roles: next,
        // Granting a role to an account that is switched off has to switch it
        // on, or the grant does nothing visible and looks like a bug. This is
        // the escape hatch for a faculty signup waiting on approval, and for
        // anyone locked out who needs to be let back in.
        ...(add ? { status: 'active' } : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
  if (error) throw error

  // The trail covers itself: a role granted from a terminal is exactly the
  // kind of change that should be as visible as one made in the product.
  await admin.from('admin_actions').insert({
    admin_id: user.id,
    action: add ? `role.grant.${role}` : `role.revoke.${role}`,
    subject_type: 'account',
    subject_id: user.id,
    detail: { email, from: current, to: next, via: 'cli' },
  })

  console.log(`${email} is now: ${next.join(', ')}${add ? ' (account active)' : ''}`)
}

const [command, email, role] = process.argv.slice(2)

const run = {
  list,
  grant: () => change(email, role, true),
  revoke: () => change(email, role, false),
}[command]

if (!run) {
  console.error('Usage: grant-role.mjs list | grant <email> <role> | revoke <email> <role>')
  process.exit(1)
}
if (command !== 'list' && (!email || !role)) {
  console.error('Both an email and a role are required.')
  process.exit(1)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
