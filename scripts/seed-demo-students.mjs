// Seeds demo students (with real auth.users rows + @umass.edu emails) and
// student-posted projects, for demoing the peer-to-peer marketplace.
//
// Why this can't be plain SQL: students.id has a hard FK to auth.users, and
// auth.users is managed exclusively by Supabase Auth — you can't insert a row
// there with regular SQL. This script uses the Admin API (service_role) to
// create real auth users first, then inserts the matching profile + project
// rows. Safe to re-run: it looks up existing users by email and reuses them
// instead of erroring or duplicating projects.
//
// The last entry (Shivansh Soni) is a real account, not a demo persona — it's
// seeded here too so it's ready to log into during the demo, but it doesn't
// get a fake posted project attached to it.
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
      title: "Textbook Swap needs a frontend that doesn't look like 2004",
      description: "backend for my textbook swap thing is done and works great, frontend is still just default bootstrap and it shows lol. need someone who can actually make it look like a real app. shouldnt take too long, i just dont have the eye for design",
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
    email: 'jordan.patel@umass.edu',
    full_name: 'Jordan Patel',
    university: 'UMass Amherst',
    major: 'Data Science',
    degree_type: 'BA',
    graduation_year: 2026,
    skills: ['Python', 'Pandas', 'Machine Learning'],
    project: {
      title: 'Can we actually predict when the dining hall gets slammed?',
      description: "so basically ive been sitting in the dining hall for like 3 months now tracking how long the lines get at different times (yes i am that person with a laptop open during lunch, no i dont care what you think about it) and ive got alot of data at this point. i threw together a rough prediction model but its honestly held together with tape, i dont really know what im doing with the ETL side of things and my postgres queries are probably an actual crime against databases. if you know how to do this properly and want to help me turn it into something that could actually be useful for freshmen trying to avoid the rush that would be amazing. not trying to make this some big startup thing, just want it to work well enough that people actually use it",
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
    email: 'sam.rivera@umass.edu',
    full_name: 'Sam Rivera',
    university: 'UMass Amherst',
    major: 'Computer Engineering',
    degree_type: 'BS',
    graduation_year: 2028,
    skills: ['C++', 'Arduino', 'Embedded Systems'],
    project: {
      title: 'Turning my dorm room into a (small) smart home',
      description: "got sensors hooked up in my room tracking temp, humidity, and my door opening/closing, all sending data over mqtt. now i just need something to actually display it in a way that makes sense instead of me squinting at raw numbers in a terminal. if youve never touched arduino before thats totally fine, ill show you the ropes, this is a pretty chill first project imo",
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
    email: 'priya.nair@umass.edu',
    full_name: 'Priya Nair',
    university: 'UMass Amherst',
    major: 'Information Science',
    degree_type: 'BS',
    graduation_year: 2027,
    skills: ['UI/UX Design', 'Figma', 'React Native'],
    project: {
      title: "Group chats are a bad way to organize a study group. Let's fix that.",
      description: "tired of trying to organize study groups over a group chat that 40 people join and 2 people actually respond in. building an app that matches you with people in the same class based on when your free and how you like to study. design and backend logic is basically done, i just need someone who can build out the actual react native app with me. down to split revenue if this ever makes any money, no promises there though",
      type: 'part-time',
      required_skills: ['React Native', 'Firebase', 'UI/UX Design'],
      complexity_level: 'intermediate',
      work_mode: 'hybrid',
      duration: 'Ongoing',
      hours_per_week: 6,
      is_paid: true,
      compensation: 'Revenue share once we launch',
    },
  },
  {
    email: 'shivanshsoni@umass.edu',
    full_name: 'Shivansh Soni',
    university: 'UMass Amherst',
    major: 'Computer Science',
    degree_type: 'BS',
    graduation_year: 2027,
    skills: ['React', 'TypeScript', 'Next.js', 'Python'],
    project: null, // real account — no fake project attached
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

    if (!demo.project) {
      console.log('  no project for this account, skipping')
      continue
    }

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

  console.log(`\nDone. All seeded demo accounts share the password: ${DEMO_PASSWORD}`)
  console.log('(That includes shivanshsoni@umass.edu — change it after logging in if you want your own.)')
}

main().catch((err) => {
  console.error('\nSeed failed:', err.message ?? err)
  process.exit(1)
})
