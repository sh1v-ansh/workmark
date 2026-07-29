// Seeds 4 demo students (with real auth.users rows + .edu emails) and 4
// student-posted projects, for demoing the peer-to-peer marketplace.
//
// Why this can't be plain SQL: students.id has a hard FK to auth.users, and
// auth.users is managed exclusively by Supabase Auth — you can't insert a row
// there with regular SQL. This script uses the Admin API (service_role) to
// create real auth users first, then inserts the matching profile + project
// rows. Safe to re-run: it looks up existing users by email and reuses them
// instead of erroring or duplicating projects.
//
// Usage:
//   node --env-file=.env.local scripts/seed-demo-students.mjs
//
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (never the
// anon key — this needs admin.createUser, which only works with service_role).

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  console.error('Run with: node --env-file=.env.local scripts/seed-demo-students.mjs')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Shared, memorable password for all demo accounts — fine for fake .edu
// identities used only to drive a live product demo.
const DEMO_PASSWORD = 'Workmark2026Demo!'

const DEMO_STUDENTS = [
  {
    email: 'maya.chen@umass.edu',
    full_name: 'Maya Chen',
    university: 'UMass Amherst',
    major: 'Computer Science',
    degree_type: 'BS',
    graduation_year: 2027,
    skills: ['React', 'TypeScript', 'Node.js'],
    project: {
      title: 'Campus Events Aggregator — need a frontend partner',
      description: 'Building a single feed that pulls events from every club and department calendar on campus. Backend and scraping are done — need someone to help build a clean React frontend with filtering and a map view.',
      type: 'project',
      required_skills: ['React', 'TypeScript', 'Tailwind CSS'],
      complexity_level: 'intermediate',
      work_mode: 'remote',
      duration: '6 weeks',
      hours_per_week: 8,
      is_paid: false,
    },
  },
  {
    email: 'jordan.patel@berkeley.edu',
    full_name: 'Jordan Patel',
    university: 'UC Berkeley',
    major: 'Data Science',
    degree_type: 'BA',
    graduation_year: 2026,
    skills: ['Python', 'Pandas', 'Machine Learning'],
    project: {
      title: 'Predicting dining hall wait times — need a data engineer',
      description: 'I have a semester of scraped wait-time data and a rough model. Looking for someone to help build a proper ETL pipeline into Postgres and improve the prediction accuracy.',
      type: 'project',
      required_skills: ['Python', 'Pandas', 'PostgreSQL'],
      complexity_level: 'advanced',
      work_mode: 'remote',
      duration: '8 weeks',
      hours_per_week: 10,
      is_paid: false,
    },
  },
  {
    email: 'sam.rivera@gatech.edu',
    full_name: 'Sam Rivera',
    university: 'Georgia Tech',
    major: 'Computer Engineering',
    degree_type: 'BS',
    graduation_year: 2028,
    skills: ['C++', 'Arduino', 'Embedded Systems'],
    project: {
      title: 'Dorm room IoT dashboard — looking for a firmware partner',
      description: "Wiring up temperature, humidity, and door sensors in my dorm room and want to display it all on a simple dashboard. I've got the frontend mostly figured out — need help with the Arduino/MQTT side.",
      type: 'project',
      required_skills: ['C++', 'Arduino', 'MQTT'],
      complexity_level: 'beginner',
      work_mode: 'onsite',
      duration: '4 weeks',
      hours_per_week: 5,
      is_paid: false,
    },
  },
  {
    email: 'priya.nair@umich.edu',
    full_name: 'Priya Nair',
    university: 'University of Michigan',
    major: 'Information Science',
    degree_type: 'BS',
    graduation_year: 2027,
    skills: ['UI/UX Design', 'Figma', 'React Native'],
    project: {
      title: 'Study group matcher — need a mobile developer',
      description: "An app that matches students in the same classes into study groups based on availability and study style. Design and backend are ready — need a React Native developer to help ship the mobile app.",
      type: 'part-time',
      required_skills: ['React Native', 'Firebase', 'UI/UX Design'],
      complexity_level: 'intermediate',
      work_mode: 'hybrid',
      duration: 'Ongoing',
      hours_per_week: 6,
      is_paid: true,
      compensation: 'Revenue share once launched',
    },
  },
]

async function findUserByEmail(email) {
  // Admin API has no direct getUserByEmail — page through listUsers.
  let page = 1
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (match) return match
    if (data.users.length < 200) return null
    page++
  }
}

async function main() {
  for (const demo of DEMO_STUDENTS) {
    console.log(`\n── ${demo.full_name} (${demo.email}) ──`)

    let user = await findUserByEmail(demo.email)
    if (user) {
      console.log('  auth user already exists, reusing')
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: demo.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { role: 'student' },
      })
      if (error) throw error
      user = data.user
      console.log('  created auth user')
    }

    const { error: studentErr } = await admin.from('students').upsert({
      id: user.id,
      full_name: demo.full_name,
      university: demo.university,
      major: demo.major,
      degree_type: demo.degree_type,
      graduation_year: demo.graduation_year,
      skills: demo.skills,
      availability: 'part-time',
    })
    if (studentErr) throw studentErr
    console.log('  student profile upserted')

    // Only insert the project once per student (idempotent re-run guard).
    const { data: existingProject } = await admin
      .from('projects')
      .select('id')
      .eq('poster_id', user.id)
      .eq('poster_type', 'student')
      .maybeSingle()

    if (existingProject) {
      console.log('  project already posted, skipping')
      continue
    }

    const { error: projectErr } = await admin.from('projects').insert({
      poster_id: user.id,
      poster_type: 'student',
      poster_display_name: demo.full_name,
      title: demo.project.title,
      description: demo.project.description,
      type: demo.project.type,
      required_skills: demo.project.required_skills,
      complexity_level: demo.project.complexity_level,
      work_mode: demo.project.work_mode,
      duration: demo.project.duration,
      hours_per_week: demo.project.hours_per_week,
      is_paid: demo.project.is_paid,
      compensation: demo.project.compensation ?? null,
      is_open: true,
    })
    if (projectErr) throw projectErr
    console.log('  project posted:', demo.project.title)
  }

  console.log(`\nDone. All demo accounts share the password: ${DEMO_PASSWORD}`)
}

main().catch((err) => {
  console.error('\nSeed failed:', err.message ?? err)
  process.exit(1)
})
