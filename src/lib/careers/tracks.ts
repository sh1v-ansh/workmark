/**
 * Career tracks: what a student is working toward, and the skills that get
 * them there, in the order to learn them.
 *
 * Hand-written from our own skill list, so every skill here is one the
 * scanner can verify. Which skills matter most was checked against O*NET's
 * software lists and their hot / in-demand flags for the matching
 * occupations (scripts/onet-career-weights.mjs); the order is ours.
 *
 * A slot lists one or more skills. Any of them counts: a backend student
 * needs a backend framework, not specifically Django.
 *
 * target: the level (1 Beginner, 2 Intermediate, 3 Advanced) a student
 *   should reach for the track. Scans top out at 3.
 * importance: 3 core, 2 important, 1 nice to have.
 * stage: 1 learn first. Later stages are only suggested once the earlier
 *   ones are done.
 */

export interface TrackSlot {
  label: string
  skills: string[]
  target: 1 | 2 | 3
  importance: 1 | 2 | 3
  stage: 1 | 2 | 3
}

export interface CareerTrack {
  id: string
  name: string
  /** What someone on this track becomes, in one line. */
  blurb: string
  slots: TrackSlot[]
}

const CLOUD = ['aws', 'gcp', 'azure']
const DEPLOY = ['vercel', 'netlify', 'render', 'railway', 'flyio', 'heroku', 'cloudflare']
const SERVER_FRAMEWORK = ['express', 'fastapi', 'django', 'flask', 'nestjs', 'spring', 'dotnet', 'laravel', 'nodejs']
const DATABASE = ['postgresql', 'mysql', 'sqlite', 'mongodb']
const UI_FRAMEWORK = ['react', 'vue', 'svelte', 'angular']
const META_FRAMEWORK = ['nextjs', 'remix', 'nuxt', 'astro']

export const CAREER_TRACKS: CareerTrack[] = [
  {
    id: 'backend',
    name: 'Backend engineer',
    blurb: 'Builds the servers, APIs and databases behind an app.',
    slots: [
      { label: 'A server-side language', skills: ['python', 'javascript', 'typescript', 'java', 'go'], target: 2, importance: 3, stage: 1 },
      { label: 'SQL', skills: ['sql'], target: 2, importance: 3, stage: 1 },
      { label: 'A backend framework', skills: SERVER_FRAMEWORK, target: 2, importance: 3, stage: 2 },
      { label: 'A database', skills: DATABASE, target: 2, importance: 3, stage: 2 },
      { label: 'REST APIs', skills: ['rest-apis'], target: 2, importance: 3, stage: 2 },
      { label: 'Unit testing', skills: ['unit-testing'], target: 1, importance: 2, stage: 2 },
      { label: 'Database design', skills: ['database-design'], target: 2, importance: 2, stage: 3 },
      { label: 'Docker', skills: ['docker'], target: 1, importance: 2, stage: 3 },
      { label: 'CI/CD', skills: ['ci-cd'], target: 1, importance: 2, stage: 3 },
      { label: 'A cloud platform', skills: CLOUD, target: 1, importance: 2, stage: 3 },
      { label: 'Caching with Redis', skills: ['redis'], target: 1, importance: 1, stage: 3 },
      { label: 'Message queues', skills: ['message-queues'], target: 1, importance: 1, stage: 3 },
    ],
  },
  {
    id: 'frontend',
    name: 'Frontend engineer',
    blurb: 'Builds the part of an app people see and use.',
    slots: [
      { label: 'HTML and CSS', skills: ['html-css'], target: 2, importance: 3, stage: 1 },
      { label: 'JavaScript', skills: ['javascript'], target: 2, importance: 3, stage: 1 },
      { label: 'TypeScript', skills: ['typescript'], target: 2, importance: 3, stage: 2 },
      { label: 'A UI framework', skills: UI_FRAMEWORK, target: 2, importance: 3, stage: 2 },
      { label: 'Tailwind CSS', skills: ['tailwind-css'], target: 1, importance: 1, stage: 2 },
      { label: 'A full framework like Next.js', skills: META_FRAMEWORK, target: 1, importance: 2, stage: 3 },
      { label: 'State management', skills: ['state-management'], target: 1, importance: 2, stage: 3 },
      { label: 'Web accessibility', skills: ['web-accessibility'], target: 1, importance: 2, stage: 3 },
      { label: 'Unit testing', skills: ['unit-testing'], target: 1, importance: 2, stage: 3 },
      { label: 'End-to-end testing', skills: ['e2e-testing'], target: 1, importance: 1, stage: 3 },
    ],
  },
  {
    id: 'fullstack',
    name: 'Full stack engineer',
    blurb: 'Builds whole apps, from the screen to the database.',
    slots: [
      { label: 'HTML and CSS', skills: ['html-css'], target: 1, importance: 3, stage: 1 },
      { label: 'JavaScript', skills: ['javascript'], target: 2, importance: 3, stage: 1 },
      { label: 'SQL', skills: ['sql'], target: 1, importance: 2, stage: 1 },
      { label: 'TypeScript', skills: ['typescript'], target: 2, importance: 2, stage: 2 },
      { label: 'A UI framework', skills: UI_FRAMEWORK, target: 2, importance: 3, stage: 2 },
      { label: 'A backend framework', skills: SERVER_FRAMEWORK, target: 2, importance: 3, stage: 2 },
      { label: 'A database', skills: DATABASE, target: 2, importance: 3, stage: 2 },
      { label: 'REST APIs', skills: ['rest-apis'], target: 2, importance: 3, stage: 3 },
      { label: 'A full framework like Next.js', skills: META_FRAMEWORK, target: 1, importance: 2, stage: 3 },
      { label: 'Authentication', skills: ['auth-platforms', 'iam'], target: 1, importance: 2, stage: 3 },
      { label: 'Deploying an app', skills: DEPLOY, target: 1, importance: 2, stage: 3 },
      { label: 'Unit testing', skills: ['unit-testing'], target: 1, importance: 2, stage: 3 },
      { label: 'Docker', skills: ['docker'], target: 1, importance: 1, stage: 3 },
    ],
  },
  {
    id: 'mobile',
    name: 'Mobile engineer',
    blurb: 'Builds apps for phones and tablets.',
    slots: [
      { label: 'A mobile language', skills: ['swift', 'kotlin', 'dart', 'javascript', 'typescript'], target: 2, importance: 3, stage: 1 },
      { label: 'A mobile framework', skills: ['react-native', 'flutter', 'swiftui', 'jetpack-compose', 'ios-development', 'android-development'], target: 2, importance: 3, stage: 2 },
      { label: 'Calling REST APIs', skills: ['rest-apis'], target: 1, importance: 2, stage: 2 },
      { label: 'A mobile backend', skills: ['firebase', 'supabase-platform'], target: 1, importance: 2, stage: 3 },
      { label: 'State management', skills: ['state-management'], target: 1, importance: 2, stage: 3 },
      { label: 'On-device storage', skills: ['sqlite'], target: 1, importance: 1, stage: 3 },
      { label: 'Unit testing', skills: ['unit-testing'], target: 1, importance: 1, stage: 3 },
    ],
  },
  {
    id: 'ai-ml',
    name: 'AI / ML engineer',
    blurb: 'Builds models and the apps that use them.',
    slots: [
      { label: 'Python', skills: ['python'], target: 2, importance: 3, stage: 1 },
      { label: 'Pandas', skills: ['pandas'], target: 2, importance: 3, stage: 1 },
      { label: 'NumPy', skills: ['numpy'], target: 1, importance: 2, stage: 1 },
      { label: 'Machine learning', skills: ['machine-learning'], target: 2, importance: 3, stage: 2 },
      { label: 'Statistical modeling', skills: ['statistical-modeling'], target: 1, importance: 2, stage: 2 },
      { label: 'Feature engineering', skills: ['feature-engineering'], target: 1, importance: 2, stage: 2 },
      { label: 'SQL', skills: ['sql'], target: 1, importance: 2, stage: 2 },
      { label: 'Deep learning', skills: ['deep-learning'], target: 1, importance: 3, stage: 3 },
      { label: 'PyTorch or TensorFlow', skills: ['pytorch', 'tensorflow'], target: 2, importance: 3, stage: 3 },
      { label: 'NLP or computer vision', skills: ['nlp', 'computer-vision'], target: 1, importance: 2, stage: 3 },
      { label: 'Building with LLMs', skills: ['rag', 'agentic-ai', 'vector-databases', 'langchain'], target: 1, importance: 2, stage: 3 },
      { label: 'MLOps', skills: ['mlops'], target: 1, importance: 1, stage: 3 },
    ],
  },
  {
    id: 'data',
    name: 'Data engineer',
    blurb: 'Moves, cleans and stores data so others can use it.',
    slots: [
      { label: 'SQL', skills: ['sql'], target: 2, importance: 3, stage: 1 },
      { label: 'Python', skills: ['python'], target: 2, importance: 3, stage: 1 },
      { label: 'Pandas', skills: ['pandas'], target: 2, importance: 3, stage: 2 },
      { label: 'A relational database', skills: ['postgresql', 'mysql'], target: 2, importance: 2, stage: 2 },
      { label: 'Data pipelines', skills: ['data-pipelines'], target: 2, importance: 3, stage: 2 },
      { label: 'Data warehousing', skills: ['data-warehousing'], target: 1, importance: 2, stage: 3 },
      { label: 'Spark or Hadoop', skills: ['big-data'], target: 1, importance: 2, stage: 3 },
      { label: 'A cloud platform', skills: CLOUD, target: 1, importance: 2, stage: 3 },
      { label: 'Docker', skills: ['docker'], target: 1, importance: 1, stage: 3 },
    ],
  },
  {
    id: 'devops',
    name: 'DevOps / cloud engineer',
    blurb: 'Keeps software building, shipping and running.',
    slots: [
      { label: 'Linux', skills: ['linux-admin'], target: 2, importance: 3, stage: 1 },
      { label: 'Shell scripting', skills: ['shell-scripting'], target: 2, importance: 3, stage: 1 },
      { label: 'A scripting language', skills: ['python', 'go'], target: 1, importance: 2, stage: 1 },
      { label: 'Docker', skills: ['docker'], target: 2, importance: 3, stage: 2 },
      { label: 'CI/CD', skills: ['ci-cd'], target: 2, importance: 3, stage: 2 },
      { label: 'A cloud platform', skills: CLOUD, target: 2, importance: 3, stage: 2 },
      { label: 'Networking', skills: ['networking'], target: 1, importance: 2, stage: 2 },
      { label: 'Kubernetes', skills: ['kubernetes'], target: 1, importance: 3, stage: 3 },
      { label: 'Terraform', skills: ['terraform'], target: 1, importance: 3, stage: 3 },
      { label: 'Monitoring', skills: ['monitoring-observability'], target: 1, importance: 2, stage: 3 },
      { label: 'Configuration management', skills: ['config-management'], target: 1, importance: 1, stage: 3 },
    ],
  },
  {
    id: 'security',
    name: 'Security engineer',
    blurb: 'Finds and fixes the ways software can be attacked.',
    slots: [
      { label: 'A programming language', skills: ['python', 'c', 'go'], target: 2, importance: 3, stage: 1 },
      { label: 'Linux', skills: ['linux-admin'], target: 1, importance: 3, stage: 1 },
      { label: 'Networking', skills: ['networking'], target: 1, importance: 3, stage: 1 },
      { label: 'Application security', skills: ['app-security'], target: 2, importance: 3, stage: 2 },
      { label: 'Network security', skills: ['network-security'], target: 1, importance: 3, stage: 2 },
      { label: 'Cryptography', skills: ['cryptography'], target: 1, importance: 2, stage: 2 },
      { label: 'Shell scripting', skills: ['shell-scripting'], target: 1, importance: 2, stage: 2 },
      { label: 'Identity and access', skills: ['iam'], target: 1, importance: 2, stage: 3 },
      { label: 'A cloud platform', skills: CLOUD, target: 1, importance: 1, stage: 3 },
      { label: 'Docker', skills: ['docker'], target: 1, importance: 1, stage: 3 },
    ],
  },
]

export const TRACK_IDS = CAREER_TRACKS.map((t) => t.id)

export function trackById(id: string | null | undefined): CareerTrack | null {
  return CAREER_TRACKS.find((t) => t.id === id) ?? null
}
