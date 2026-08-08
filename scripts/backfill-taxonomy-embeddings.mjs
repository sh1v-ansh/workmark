// One-time backfill: embeds every taxonomy skill's canonical_name via
// Voyage and writes it to skills.embedding. Run once after
// seed_skills_taxonomy.sql, and again any time new skill nodes are added
// (it only touches rows where embedding is still null, so it's safe to
// re-run — existing embeddings are never recomputed).
//
// Standalone script, not importing src/lib/embeddings/voyage.ts — these
// scripts run via plain `node`, with no TypeScript/path-alias resolution,
// so the same minimal fetch call is duplicated here rather than sharing
// the module. Keep the two in sync if the Voyage call shape changes.
//
// Usage:
//   node --env-file=.env.local scripts/backfill-taxonomy-embeddings.mjs

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}
if (!VOYAGE_API_KEY) {
  console.error('Missing VOYAGE_API_KEY.')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const MODEL = 'voyage-4'
const OUTPUT_DIMENSION = 1024
const BATCH_SIZE = 32 // comfortably under Voyage's per-request input limits

async function embedBatch(texts) {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: texts, model: MODEL, output_dimension: OUTPUT_DIMENSION }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Voyage request failed (${res.status}): ${body}`)
  }
  const json = await res.json()
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding)
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function main() {
  const { data: skills, error } = await admin
    .from('skills')
    .select('id, canonical_name')
    .is('embedding', null)
  if (error) throw error

  if (!skills || skills.length === 0) {
    console.log('Nothing to backfill — every skill already has an embedding.')
    return
  }
  console.log(`Backfilling ${skills.length} skill(s)...`)

  for (const batch of chunk(skills, BATCH_SIZE)) {
    const embeddings = await embedBatch(batch.map((s) => s.canonical_name))
    for (let i = 0; i < batch.length; i++) {
      // Routed through the update_skill_embedding RPC rather than a plain
      // .update() — writing a `vector` column via PostgREST has no
      // guaranteed cast from a JSON array, so the cast is done explicitly
      // in SQL instead (see schema.sql).
      const { error: updateErr } = await admin.rpc('update_skill_embedding', {
        p_skill_id: batch[i].id,
        p_embedding: embeddings[i],
      })
      if (updateErr) throw updateErr
    }
    console.log(`  embedded: ${batch.map((s) => s.canonical_name).join(', ')}`)
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error('\nBackfill failed:', err.message ?? err)
  process.exit(1)
})
