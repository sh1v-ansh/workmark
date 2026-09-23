// Make (or remove) an extra login for testing, without a second .edu inbox.
//
// The account is created already email-confirmed, so no verification email
// is needed. Log in with the password, and onboarding runs as normal.
//
// Use a "+" address on your own .edu email (you+test1@school.edu). It still
// ends in .edu, so signup accepts it, and most university mail — Google and
// Microsoft both — delivers it to your normal inbox, so Workmark's emails to
// the test account reach you too. A made-up address would work for logging
// in, but every email sent to it would bounce, and bounces count against the
// sending domain's reputation.
//
// Usage:
//   node --env-file=.env.local scripts/test-account.mjs create you+test1@school.edu 'a-password'
//   node --env-file=.env.local scripts/test-account.mjs delete you+test1@school.edu

import { createClient } from '@supabase/supabase-js'

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
const [command, email, password] = process.argv.slice(2)

async function findUser(address) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data.users.find((u) => u.email?.toLowerCase() === address.toLowerCase())
    if (hit) return hit
    if (data.users.length < 200) return null
  }
  return null
}

if (command === 'create' && email && password) {
  if (!email.toLowerCase().endsWith('.edu')) {
    console.error('Signup only accepts .edu addresses. Use you+test1@school.edu.')
    process.exit(1)
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.')
    process.exit(1)
  }
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) {
    console.error('Could not create it:', error.message)
    process.exit(1)
  }
  console.log(`Created ${data.user.email}. Log in with that email and password; onboarding starts from step 1.`)
} else if (command === 'delete' && email) {
  const user = await findUser(email)
  if (!user) {
    console.error('No account with that email.')
    process.exit(1)
  }
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) {
    console.error('Could not delete it:', error.message)
    process.exit(1)
  }
  console.log(`Deleted ${email} and everything attached to it.`)
} else {
  console.error("Usage:\n  create <email> '<password>'\n  delete <email>")
  process.exit(1)
}
