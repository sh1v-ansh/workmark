// Gives every seeded student a random set of Tier 3 "GitHub-evidenced"
// skills, as if they'd connected GitHub and run a scan — without needing a
// real GitHub OAuth app configured. Excludes Shivansh Soni (full_name match)
// since that account is meant to exercise the real Connect GitHub flow next.
//
// Why this exists: the verified-skill gate on peer projects (migration 0004)
// only counts Tier 1/2/3 VERIFIED skills, never self-reported ones. The 31+
// demo students seeded by seed-demo-students.mjs only have self-reported
// skills, so none of them can currently see or apply to the gated peer
// projects. This backfills a plausible Tier 3 skill set for each of them.
//
// Safe to re-run: deletes + reinserts each student's github_evidenced_skills
// every run (same pattern as the posted-project reseed), and sets a
// plausible github_username so the dashboard shows "connected" state too.
//
// Usage:
//   node --env-file=.env.local scripts/seed-github-skills.mjs

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  console.error('Run with: node --env-file=.env.local scripts/seed-github-skills.mjs')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const EXCLUDE_FULL_NAME = 'Shivansh Soni'

// A broad, realistic pool — deliberately overlaps with the required_skills
// on the 4 seeded peer projects (React/TypeScript/Tailwind, Python/Pandas/
// PostgreSQL, C++/Arduino/MQTT, React Native/Firebase/UI-UX) since those are
// common technologies anyway, so random sampling naturally lets some
// students qualify instead of gating out literally everyone.
const SKILL_POOL = [
  'JavaScript', 'TypeScript', 'Python', 'React', 'React Native', 'Next.js', 'Node.js', 'Express',
  'Vue', 'Tailwind CSS', 'HTML/CSS', 'Java', 'C++', 'C', 'Go', 'Rust', 'Arduino', 'MQTT',
  'Embedded Systems', 'PostgreSQL', 'MySQL', 'MongoDB', 'Firebase', 'Supabase', 'Docker',
  'Kubernetes', 'AWS', 'GraphQL', 'REST APIs', 'Pandas', 'NumPy', 'Machine Learning', 'TensorFlow',
  'PyTorch', 'Tableau', 'Figma', 'UI/UX Design', 'Swift', 'Kotlin', 'Flutter', 'Redis', 'Git',
]

function slugUsername(fullName) {
  return fullName.toLowerCase().replace(/[^a-z]+/g, '').slice(0, 20) + Math.floor(Math.random() * 900 + 100)
}

function randomSkillSet() {
  const shuffled = [...SKILL_POOL].sort(() => Math.random() - 0.5)
  const count = 3 + Math.floor(Math.random() * 5) // 3–7 skills
  return shuffled.slice(0, count)
}

async function main() {
  const { data: students, error } = await admin.from('students').select('id, full_name')
  if (error) throw error

  const targets = (students ?? []).filter((s) => s.full_name !== EXCLUDE_FULL_NAME)
  console.log(`Seeding GitHub-evidenced skills for ${targets.length} students (excluding ${EXCLUDE_FULL_NAME})…`)

  for (const student of targets) {
    const { error: deleteErr } = await admin.from('github_evidenced_skills').delete().eq('student_id', student.id)
    if (deleteErr) throw deleteErr

    const skills = randomSkillSet()
    const rows = skills.map((skill) => ({
      student_id: student.id,
      skill,
      evidence_count: 1 + Math.floor(Math.random() * 4), // 1–4 repos
    }))
    const { error: insertErr } = await admin.from('github_evidenced_skills').insert(rows)
    if (insertErr) throw insertErr

    const username = slugUsername(student.full_name ?? 'student')
    const { error: updateErr } = await admin
      .from('students')
      .update({ github_username: username, github_url: `https://github.com/${username}` })
      .eq('id', student.id)
    if (updateErr) throw updateErr

    console.log(`  ${student.full_name}: ${skills.join(', ')}`)
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error('\nSeed failed:', err.message ?? err)
  process.exit(1)
})
