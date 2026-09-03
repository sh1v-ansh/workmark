// Known package names, mapped to taxonomy skills by hand.
//
// Every entry here comes from real unresolved strings in the first batch of
// scans, not from imagination. The list is the cheapest possible fix for the
// most common misses, and it removes them from the review queue permanently.
//
// Why this is needed even though embeddings exist: similarity scoring is bad
// at short bare tokens. Measured on the real data — `postgres` scored 81%
// against PostgreSQL, `docker` 75% against Docker, `numpy` 70% against
// NumPy. All correct, all below the 0.85 auto-accept bar. Embeddings are
// good at "a React state management library" and poor at "pg".
//
// Values are taxonomy ids from seed_skills_taxonomy.sql. Keys are normalized
// (see normalizeName): lowercase, scope stripped, punctuation removed.

export const SEED_ALIASES: Record<string, string> = {
  // ── Databases ────────────────────────────────────────────────────────────
  postgres: 'postgresql', postgresql: 'postgresql', pg: 'postgresql',
  psycopg2: 'postgresql', psycopg2binary: 'postgresql', asyncpg: 'postgresql',
  pgpromise: 'postgresql', libpq: 'postgresql',
  mysql: 'mysql', mysql2: 'mysql', pymysql: 'mysql',
  mongodb: 'mongodb', mongoose: 'mongodb', pymongo: 'mongodb',
  redis: 'redis', ioredis: 'redis',
  sqlite: 'sqlite', sqlite3: 'sqlite', betsqlite3: 'sqlite',
  elasticsearch: 'elasticsearch',
  prisma: 'database-design', drizzleorm: 'database-design',
  sqlalchemy: 'database-design', typeorm: 'database-design',
  knex: 'database-design', alembic: 'database-design',

  // ── Languages ────────────────────────────────────────────────────────────
  typescript: 'typescript', javascript: 'javascript',
  python: 'python', golang: 'go', rustlang: 'rust',
  html: 'html-css', css: 'html-css', htmlcss: 'html-css', sass: 'html-css',
  scss: 'html-css', less: 'html-css',
  shell: 'shell-scripting', bash: 'shell-scripting', zsh: 'shell-scripting',
  powershell: 'shell-scripting', sh: 'shell-scripting',

  // ── Frontend ─────────────────────────────────────────────────────────────
  react: 'react', reactdom: 'react', reactrouter: 'react', reactrouterdom: 'react',
  next: 'nextjs', nextjs: 'nextjs', 'next.js': 'nextjs',
  node: 'nodejs', nodejs: 'nodejs', 'node.js': 'nodejs',
  'vue.js': 'vue', vuejs: 'vue',
  vue: 'vue', nuxt: 'nuxt', svelte: 'svelte', sveltekit: 'svelte',
  angular: 'angular', astro: 'astro', remix: 'remix', vite: 'vite',
  tailwindcss: 'tailwind-css', tailwind: 'tailwind-css',
  redux: 'state-management', reduxtoolkit: 'state-management',
  zustand: 'state-management', jotai: 'state-management', recoil: 'state-management',
  mobx: 'state-management', tanstackreactquery: 'state-management',
  reactquery: 'state-management',
  // Icon and component libraries are design-system work in practice.
  lucidereact: 'design-systems', radixui: 'design-systems',
  headlessui: 'design-systems', shadcnui: 'design-systems', chakraui: 'design-systems',
  mui: 'design-systems', materialui: 'design-systems', antd: 'design-systems',
  framermotion: 'design-systems',

  // ── Backend / APIs ───────────────────────────────────────────────────────
  express: 'express', fastify: 'express', koa: 'express', hapi: 'express',
  django: 'django', djangorestframework: 'django',
  flask: 'flask', fastapi: 'fastapi', uvicorn: 'fastapi', gunicorn: 'fastapi',
  starlette: 'fastapi', pydantic: 'fastapi',
  nestjs: 'nestjs', spring: 'spring', springboot: 'spring', laravel: 'laravel',
  axios: 'rest-apis', requests: 'rest-apis', httpx: 'rest-apis',
  aiohttp: 'rest-apis', gotrue: 'rest-apis', cors: 'rest-apis',
  graphql: 'graphql', apollo: 'graphql', apolloclient: 'graphql',
  apolloserver: 'graphql', urql: 'graphql',
  socketio: 'websockets', ws: 'websockets', wss: 'websockets',
  celery: 'message-queues', bullmq: 'message-queues', rabbitmq: 'message-queues',
  kafka: 'message-queues', kafkajs: 'message-queues',

  // ── Data / ML ────────────────────────────────────────────────────────────
  numpy: 'numpy', np: 'numpy', scipy: 'numpy',
  pandas: 'pandas', polars: 'pandas',
  torch: 'pytorch', pytorch: 'pytorch', torchvision: 'pytorch',
  torchaudio: 'pytorch', pytorchlightning: 'pytorch', lightning: 'pytorch',
  tensorflow: 'tensorflow', keras: 'tensorflow', tf: 'tensorflow',
  sklearn: 'machine-learning', scikitlearn: 'machine-learning',
  xgboost: 'machine-learning', lightgbm: 'machine-learning',
  transformers: 'nlp', huggingfacehub: 'nlp', spacy: 'nlp', nltk: 'nlp',
  tokenizers: 'nlp', sentencetransformers: 'nlp',
  opencv: 'computer-vision', opencvpython: 'computer-vision', cv2: 'computer-vision',
  pillow: 'computer-vision', pil: 'computer-vision',
  matplotlib: 'statistical-modeling', seaborn: 'statistical-modeling',
  plotly: 'statistical-modeling', statsmodels: 'statistical-modeling',
  statistics: 'statistical-modeling', scipystats: 'statistical-modeling',
  jupyter: 'data-pipelines', jupyterlab: 'data-pipelines', notebook: 'data-pipelines',
  ipykernel: 'data-pipelines', airflow: 'data-pipelines', dbt: 'data-pipelines',
  gym: 'reinforcement-learning', gymnasium: 'reinforcement-learning',
  stablebaselines3: 'reinforcement-learning',
  mlflow: 'mlops', wandb: 'mlops', weightsandbiases: 'mlops',

  // ── AI tooling ───────────────────────────────────────────────────────────
  openai: 'agentic-ai', anthropic: 'agentic-ai', langchain: 'langchain',
  langgraph: 'langchain', llamaindex: 'rag', chromadb: 'vector-databases',
  pinecone: 'vector-databases', pineconeclient: 'vector-databases',
  weaviate: 'vector-databases', qdrant: 'vector-databases', faiss: 'vector-databases',
  pgvector: 'vector-databases',

  // ── Infrastructure ───────────────────────────────────────────────────────
  docker: 'docker', dockerfile: 'docker', dockercompose: 'docker',
  multistagedockerbuild: 'docker',
  kubernetes: 'kubernetes', k8s: 'kubernetes', helm: 'kubernetes', kubectl: 'kubernetes',
  terraform: 'terraform', pulumi: 'terraform', ansible: 'config-management',
  nginx: 'load-balancing', traefik: 'load-balancing', haproxy: 'load-balancing',
  cicd: 'ci-cd', githubactions: 'ci-cd', cimatrixbuilds: 'ci-cd',
  prometheus: 'monitoring-observability', grafana: 'monitoring-observability',
  opentelemetry: 'monitoring-observability', datadog: 'monitoring-observability',
  make: 'shell-scripting', cmake: 'cpp', pybind11: 'cpp', vagrant: 'virtualization',

  // ── Platforms ────────────────────────────────────────────────────────────
  supabase: 'supabase-platform', supabasejs: 'supabase-platform',
  supabasesupabasejs: 'supabase-platform', supabasessr: 'supabase-platform',
  firebase: 'firebase', firebaseadmin: 'firebase',
  vercel: 'vercel', netlify: 'netlify', cloudflare: 'cloudflare',
  stripe: 'stripe-integration', twilio: 'twilio',
  sentry: 'sentry', sentrynextjs: 'sentry', posthog: 'posthog',
  resend: 'email-delivery', nodemailer: 'email-delivery', sendgrid: 'email-delivery',
  nextauth: 'auth-platforms', clerk: 'auth-platforms', auth0: 'auth-platforms',
  passport: 'auth-platforms', jsonwebtoken: 'auth-platforms', pyjwt: 'auth-platforms',
  boto3: 'aws', awssdk: 'aws',

  // ── Testing ──────────────────────────────────────────────────────────────
  pytest: 'unit-testing', jest: 'unit-testing', vitest: 'unit-testing',
  mocha: 'unit-testing', chai: 'unit-testing', junit: 'unit-testing',
  unittest: 'unit-testing', testinglibraryreact: 'unit-testing',
  playwright: 'e2e-testing', cypress: 'e2e-testing', selenium: 'e2e-testing',
  puppeteer: 'e2e-testing',
  supertest: 'integration-testing',

  // ── Systems ──────────────────────────────────────────────────────────────
  cuda: 'cuda', cudatoolkit: 'cuda', cupy: 'cuda', triton: 'cuda',
  concurrent: 'concurrency', asyncio: 'concurrency', tokio: 'concurrency',
  rayon: 'concurrency', concurrencyparallelism: 'concurrency',
  grpc: 'distributed-systems', protobuf: 'distributed-systems',
  protocolbuffers: 'distributed-systems',

  // ── Mobile / game ────────────────────────────────────────────────────────
  reactnative: 'react-native', expo: 'react-native', flutter: 'flutter',
  swiftui: 'swiftui', jetpackcompose: 'jetpack-compose',
  unity: 'unity', unrealengine: 'unreal-engine', godot: 'godot',
  three: 'graphics-programming', threejs: 'graphics-programming',
  reactthreefiber: 'graphics-programming', opengl: 'graphics-programming',
  glfw: 'graphics-programming', vulkan: 'graphics-programming',

  // ── Security ─────────────────────────────────────────────────────────────
  bcrypt: 'cryptography', argon2: 'cryptography', cryptography: 'cryptography',
  pynacl: 'cryptography', openssl: 'cryptography',

  // ── Detector output ──────────────────────────────────────────────────────
  // Phrases the file detectors emit rather than package names.
  databaseschemadesign: 'database-design', databaseindexing: 'database-design',
  datamodelling: 'database-design', storedprocedures: 'database-design',
  protocolbuffers2: 'distributed-systems',
}
