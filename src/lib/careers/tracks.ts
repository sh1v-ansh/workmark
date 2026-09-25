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
 * stage: 1 Foundations, 2 Core, 3 Production, 4 Going further. Later
 *   stages are only suggested once the earlier ones are done.
 */

export interface TrackSlot {
  label: string
  skills: string[]
  target: 1 | 2 | 3
  importance: 1 | 2 | 3
  stage: 1 | 2 | 3 | 4
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

export const STAGE_NAMES: Record<number, string> = {
  1: 'Foundations',
  2: 'Core',
  3: 'Production',
  4: 'Going further',
}

const AUTH = ['auth-platforms', 'iam']
const LLM_APPS = ['rag', 'agentic-ai', 'langchain']
const NOSQL = ['mongodb', 'dynamodb', 'cassandra', 'redis']

// Shorthand: slot(label, skills, target, importance, stage)
const slot = (
  label: string, skills: string[] | string, target: 1 | 2 | 3, importance: 1 | 2 | 3, stage: 1 | 2 | 3 | 4,
): TrackSlot => ({ label, skills: Array.isArray(skills) ? skills : [skills], target, importance, stage })

export const CAREER_TRACKS: CareerTrack[] = [
  {
    id: 'backend',
    name: 'Backend engineer',
    blurb: 'Builds the servers, APIs and databases behind an app.',
    slots: [
      slot('A server-side language', ['python', 'javascript', 'typescript', 'java', 'go'], 3, 3, 1),
      slot('SQL', 'sql', 2, 3, 1),
      slot('A backend framework', SERVER_FRAMEWORK, 2, 3, 2),
      slot('A database', DATABASE, 2, 3, 2),
      slot('REST APIs', 'rest-apis', 2, 3, 2),
      slot('Database design', 'database-design', 2, 2, 2),
      slot('Unit testing', 'unit-testing', 2, 2, 2),
      slot('API design and docs', 'api-design', 1, 2, 2),
      slot('Docker', 'docker', 2, 3, 3),
      slot('CI/CD', 'ci-cd', 1, 2, 3),
      slot('Authentication', AUTH, 1, 2, 3),
      slot('Integration testing', 'integration-testing', 1, 2, 3),
      slot('Caching with Redis', 'redis', 1, 2, 3),
      slot('Deploying an app', [...DEPLOY, ...CLOUD], 1, 2, 3),
      slot('Application security', 'app-security', 1, 2, 3),
      slot('Shell scripting', 'shell-scripting', 1, 1, 3),
      slot('A cloud platform', CLOUD, 2, 2, 4),
      slot('Message queues', 'message-queues', 1, 2, 4),
      slot('Monitoring', ['monitoring-observability', 'sentry'], 1, 2, 4),
      slot('Concurrency', 'concurrency', 1, 1, 4),
      slot('GraphQL', 'graphql', 1, 1, 4),
      slot('Load testing', 'performance-testing', 1, 1, 4),
      slot('Kubernetes', 'kubernetes', 1, 1, 4),
      slot('Distributed systems', 'distributed-systems', 1, 1, 4),
    ],
  },
  {
    id: 'frontend',
    name: 'Frontend engineer',
    blurb: 'Builds the part of an app people see and use.',
    slots: [
      slot('HTML and CSS', 'html-css', 2, 3, 1),
      slot('JavaScript', 'javascript', 2, 3, 1),
      slot('TypeScript', 'typescript', 2, 3, 2),
      slot('A UI framework', UI_FRAMEWORK, 3, 3, 2),
      slot('Calling APIs', ['rest-apis', 'graphql'], 1, 2, 2),
      slot('State management', 'state-management', 1, 2, 2),
      slot('Tailwind CSS', 'tailwind-css', 1, 1, 2),
      slot('A full framework like Next.js', META_FRAMEWORK, 2, 2, 3),
      slot('Unit testing', 'unit-testing', 1, 2, 3),
      slot('Web accessibility', 'web-accessibility', 1, 2, 3),
      slot('Deploying an app', DEPLOY, 1, 2, 3),
      slot('Build tools', 'vite', 1, 1, 3),
      slot('Authentication', AUTH, 1, 1, 3),
      slot('End-to-end testing', 'e2e-testing', 1, 2, 4),
      slot('Design systems', 'design-systems', 1, 2, 4),
      slot('Progressive web apps', 'pwa', 1, 1, 4),
      slot('Real-time with WebSockets', 'websockets', 1, 1, 4),
      slot('Internationalization', 'i18n', 1, 1, 4),
      slot('Error monitoring', 'sentry', 1, 1, 4),
    ],
  },
  {
    id: 'fullstack',
    name: 'Web / full stack engineer',
    blurb: 'Builds whole apps, from the screen to the database.',
    slots: [
      slot('HTML and CSS', 'html-css', 2, 3, 1),
      slot('JavaScript', 'javascript', 2, 3, 1),
      slot('SQL', 'sql', 2, 2, 1),
      slot('TypeScript', 'typescript', 2, 2, 2),
      slot('A UI framework', UI_FRAMEWORK, 2, 3, 2),
      slot('A backend framework', SERVER_FRAMEWORK, 2, 3, 2),
      slot('A database', DATABASE, 2, 3, 2),
      slot('REST APIs', 'rest-apis', 2, 3, 2),
      slot('A full framework like Next.js', META_FRAMEWORK, 2, 2, 3),
      slot('Authentication', AUTH, 1, 3, 3),
      slot('Deploying an app', DEPLOY, 1, 3, 3),
      slot('Database design', 'database-design', 1, 2, 3),
      slot('Unit testing', 'unit-testing', 1, 2, 3),
      slot('State management', 'state-management', 1, 2, 3),
      slot('Tailwind CSS', 'tailwind-css', 1, 1, 3),
      slot('Docker', 'docker', 1, 2, 4),
      slot('CI/CD', 'ci-cd', 1, 2, 4),
      slot('Payments', 'stripe-integration', 1, 1, 4),
      slot('Sending email', 'email-delivery', 1, 1, 4),
      slot('Caching with Redis', 'redis', 1, 1, 4),
      slot('End-to-end testing', 'e2e-testing', 1, 1, 4),
      slot('Real-time with WebSockets', 'websockets', 1, 1, 4),
      slot('Application security', 'app-security', 1, 1, 4),
    ],
  },
  {
    id: 'mobile',
    name: 'Mobile engineer',
    blurb: 'Builds apps for phones and tablets.',
    slots: [
      slot('A mobile language', ['swift', 'kotlin', 'dart', 'javascript', 'typescript'], 2, 3, 1),
      slot('A mobile framework', ['react-native', 'flutter', 'swiftui', 'jetpack-compose', 'ios-development', 'android-development'], 3, 3, 2),
      slot('Calling REST APIs', 'rest-apis', 1, 2, 2),
      slot('State management', 'state-management', 1, 2, 2),
      slot('A mobile backend', ['firebase', 'supabase-platform'], 1, 2, 3),
      slot('On-device storage', 'sqlite', 1, 2, 3),
      slot('Authentication', AUTH, 1, 2, 3),
      slot('Unit testing', 'unit-testing', 1, 2, 3),
      slot('CI/CD', 'ci-cd', 1, 1, 3),
      slot('End-to-end testing', 'e2e-testing', 1, 1, 4),
      slot('Payments', 'stripe-integration', 1, 1, 4),
      slot('Push and messaging', 'twilio', 1, 1, 4),
      slot('Accessibility', 'web-accessibility', 1, 1, 4),
      slot('Internationalization', 'i18n', 1, 1, 4),
      slot('Error monitoring', 'sentry', 1, 1, 4),
    ],
  },
  {
    id: 'ai-ml',
    name: 'AI / ML engineer',
    blurb: 'Builds models and the apps that use them.',
    slots: [
      slot('Python', 'python', 3, 3, 1),
      slot('NumPy', 'numpy', 1, 2, 1),
      slot('Pandas', 'pandas', 2, 3, 1),
      slot('SQL', 'sql', 1, 2, 1),
      slot('Machine learning', 'machine-learning', 2, 3, 2),
      slot('Statistical modeling', 'statistical-modeling', 1, 2, 2),
      slot('Feature engineering', 'feature-engineering', 1, 2, 2),
      slot('Data pipelines', 'data-pipelines', 1, 1, 2),
      slot('Deep learning', 'deep-learning', 2, 3, 3),
      slot('PyTorch or TensorFlow', ['pytorch', 'tensorflow'], 2, 3, 3),
      slot('NLP or computer vision', ['nlp', 'computer-vision'], 1, 2, 3),
      slot('Building with LLMs', LLM_APPS, 1, 2, 3),
      slot('Prompt engineering', 'prompt-engineering', 1, 2, 3),
      slot('Vector databases', 'vector-databases', 1, 2, 3),
      slot('Serving a model as an API', ['fastapi', 'flask'], 1, 2, 3),
      slot('MLOps', 'mlops', 1, 2, 4),
      slot('Docker', 'docker', 1, 2, 4),
      slot('Fine-tuning', 'fine-tuning', 1, 1, 4),
      slot('A cloud platform', CLOUD, 1, 1, 4),
      slot('Spark or Hadoop', 'big-data', 1, 1, 4),
      slot('GPU programming', 'cuda', 1, 1, 4),
      slot('Recommender systems', 'recommender-systems', 1, 1, 4),
      slot('Reinforcement learning', 'reinforcement-learning', 1, 1, 4),
    ],
  },
  {
    id: 'data',
    name: 'Data engineer',
    blurb: 'Moves, cleans and stores data so others can use it.',
    slots: [
      slot('SQL', 'sql', 3, 3, 1),
      slot('Python', 'python', 2, 3, 1),
      slot('Pandas', 'pandas', 2, 3, 2),
      slot('A relational database', ['postgresql', 'mysql'], 2, 3, 2),
      slot('Data pipelines', 'data-pipelines', 2, 3, 2),
      slot('Database design', 'database-design', 2, 2, 2),
      slot('Shell scripting', 'shell-scripting', 1, 2, 2),
      slot('Data warehousing', 'data-warehousing', 1, 3, 3),
      slot('Spark or Hadoop', 'big-data', 1, 3, 3),
      slot('A cloud platform', CLOUD, 1, 2, 3),
      slot('Docker', 'docker', 1, 2, 3),
      slot('A NoSQL database', NOSQL, 1, 2, 3),
      slot('Unit testing', 'unit-testing', 1, 1, 3),
      slot('Streaming with message queues', 'message-queues', 1, 2, 4),
      slot('CI/CD', 'ci-cd', 1, 1, 4),
      slot('Terraform', 'terraform', 1, 1, 4),
      slot('Monitoring', 'monitoring-observability', 1, 1, 4),
      slot('Statistical modeling', 'statistical-modeling', 1, 1, 4),
      slot('Time series', 'time-series-analysis', 1, 1, 4),
      slot('Search with Elasticsearch', 'elasticsearch', 1, 1, 4),
    ],
  },
  {
    id: 'devops',
    name: 'DevOps / cloud engineer',
    blurb: 'Keeps software building, shipping and running.',
    slots: [
      slot('Linux', 'linux-admin', 2, 3, 1),
      slot('Shell scripting', 'shell-scripting', 2, 3, 1),
      slot('A scripting language', ['python', 'go'], 2, 2, 1),
      slot('Networking', 'networking', 1, 2, 1),
      slot('Docker', 'docker', 2, 3, 2),
      slot('CI/CD', 'ci-cd', 2, 3, 2),
      slot('A cloud platform', CLOUD, 2, 3, 2),
      slot('Load balancing', 'load-balancing', 1, 2, 2),
      slot('Kubernetes', 'kubernetes', 2, 3, 3),
      slot('Terraform', 'terraform', 2, 3, 3),
      slot('Monitoring', 'monitoring-observability', 1, 3, 3),
      slot('Configuration management', 'config-management', 1, 2, 3),
      slot('Identity and access', 'iam', 1, 2, 3),
      slot('A database', DATABASE, 1, 1, 3),
      slot('Serverless', 'serverless', 1, 2, 4),
      slot('Network security', 'network-security', 1, 2, 4),
      slot('Distributed systems', 'distributed-systems', 1, 1, 4),
      slot('Virtualization', 'virtualization', 1, 1, 4),
      slot('Load testing', 'performance-testing', 1, 1, 4),
      slot('Message queues', 'message-queues', 1, 1, 4),
    ],
  },
  {
    id: 'security',
    name: 'Security engineer',
    blurb: 'Finds and fixes the ways software can be attacked.',
    slots: [
      slot('A programming language', ['python', 'c', 'go'], 2, 3, 1),
      slot('Linux', 'linux-admin', 2, 3, 1),
      slot('Networking', 'networking', 1, 3, 1),
      slot('Shell scripting', 'shell-scripting', 1, 2, 1),
      slot('Application security', 'app-security', 2, 3, 2),
      slot('Network security', 'network-security', 1, 3, 2),
      slot('Cryptography', 'cryptography', 1, 3, 2),
      slot('How web apps work', ['rest-apis', 'html-css'], 1, 2, 2),
      slot('SQL', 'sql', 1, 2, 2),
      slot('Identity and access', 'iam', 1, 3, 3),
      slot('Authentication', 'auth-platforms', 1, 2, 3),
      slot('Docker', 'docker', 1, 2, 3),
      slot('A cloud platform', CLOUD, 1, 2, 3),
      slot('Monitoring and logging', 'monitoring-observability', 1, 2, 3),
      slot('Low-level C', 'c', 1, 2, 4),
      slot('Assembly', 'assembly', 1, 1, 4),
      slot('Kubernetes', 'kubernetes', 1, 1, 4),
      slot('Terraform', 'terraform', 1, 1, 4),
      slot('Smart contract security', 'smart-contracts', 1, 1, 4),
    ],
  },
  {
    id: 'game-dev',
    name: 'Game developer',
    blurb: 'Builds games: the engine, the feel, the graphics and the netcode.',
    slots: [
      slot('A game language', ['cpp', 'javascript', 'typescript', 'python', 'lua', 'rust'], 2, 3, 1),
      slot('A game engine', ['unity', 'godot', 'unreal-engine'], 2, 3, 1),
      slot('3D graphics', 'graphics-programming', 1, 3, 2),
      slot('Physics', 'physics-simulation', 1, 2, 2),
      slot('Shaders', 'shader-programming', 1, 2, 2),
      slot('Unit testing', 'unit-testing', 1, 1, 2),
      slot('Multiplayer networking', 'multiplayer-networking', 1, 2, 3),
      slot('Real-time with WebSockets', 'websockets', 1, 1, 3),
      slot('Concurrency', 'concurrency', 1, 2, 3),
      slot('C++ for games', 'cpp', 2, 2, 3),
      slot('CI/CD', 'ci-cd', 1, 1, 3),
      slot('VR or AR', ['vr-development', 'ar-development'], 1, 1, 4),
      slot('GPU programming', 'cuda', 1, 1, 4),
      slot('A game backend', ['firebase', 'supabase-platform'], 1, 1, 4),
      slot('Computer vision', 'computer-vision', 1, 1, 4),
    ],
  },
  {
    id: 'robotics',
    name: 'Robotics engineer',
    blurb: 'Writes the software that lets robots sense, plan and move.',
    slots: [
      slot('Python', 'python', 2, 3, 1),
      slot('C++', 'cpp', 2, 3, 1),
      slot('Linux', 'linux-admin', 1, 2, 1),
      slot('Robotics with ROS', 'robotics', 2, 3, 2),
      slot('Computer vision', 'computer-vision', 1, 3, 2),
      slot('NumPy', 'numpy', 1, 2, 2),
      slot('Physics simulation', 'physics-simulation', 1, 2, 2),
      slot('Unit testing', 'unit-testing', 1, 1, 2),
      slot('Embedded systems', 'embedded-systems', 1, 2, 3),
      slot('Real-time systems', 'real-time-systems', 1, 2, 3),
      slot('Concurrency', 'concurrency', 1, 2, 3),
      slot('Machine learning', 'machine-learning', 1, 2, 3),
      slot('Docker', 'docker', 1, 1, 3),
      slot('Reinforcement learning', 'reinforcement-learning', 1, 1, 4),
      slot('Deep learning', ['pytorch', 'tensorflow'], 1, 1, 4),
      slot('GPU programming', 'cuda', 1, 1, 4),
      slot('CAD', 'cad', 1, 1, 4),
      slot('CI/CD', 'ci-cd', 1, 1, 4),
    ],
  },
]

export const TRACK_IDS = CAREER_TRACKS.map((t) => t.id)

export function trackById(id: string | null | undefined): CareerTrack | null {
  return CAREER_TRACKS.find((t) => t.id === id) ?? null
}
