-- ============================================================
--  WORKMARK — Canonical skill taxonomy seed (Phase 0, draft for review)
--
--  17 category parents + 163 claimable leaf skills. Categories exist for
--  canonicalization/UI grouping — students and posters almost always
--  claim/require a leaf, not a category.
--
--  This deliberately exceeds the original "60-80 nodes" guidance in the
--  product spec — broader coverage was requested explicitly (website dev,
--  game dev, systems dev, sysadmin, AI/data science, platforms, niche
--  areas) over the original "don't explode into five thousand tags"
--  ceiling. Still a curated, hand-authored list, not an open tag cloud.
--
--  EVERY LEAF MUST BE INFERABLE FROM A REPO — this is a hard constraint,
--  not a nice-to-have. In MVP there is no attestation, so GitHub scanning
--  is the ONLY evidence source (§5): a skill nobody can produce
--  skill_evidence for is a dead node in the presence-filter/matching
--  pipeline no matter how real the skill is. A pass against this
--  constraint cut 16 nodes that had no realistic file/config/dependency
--  signature — mostly process/role skills (Product Management, User
--  Research, TDD, SRE, Penetration Testing) or pure-operational sysadmin
--  work that never touches version control (Windows Server Admin, Active
--  Directory). Each cut is left as an inline comment at its old position
--  explaining why, and most of these are legitimate candidates to return
--  once faculty/employer attestation exists — attestation doesn't need a
--  repo at all, so a professor can vouch for product/design work no
--  scanner ever could.
--
--  id is a stable text slug, not a uuid — every other table in this schema
--  uses uuid primary keys, but this one table is a fixed, hand-authored
--  vocabulary referenced directly in code (skill_aliases, matching, seed
--  data) — a slug is what you want to type in a WHERE clause.
--
--  embedding is left null here. Populated by a one-time backfill script
--  once a Voyage API key exists (Phase 1).
--
--  EDIT THIS LIST before it's run. Once listings and evidence reference
--  these ids, renaming one means a migration (or a deprecated_at +
--  merged_into_id row — see schema.sql), not a text edit.
-- ============================================================

insert into skills (id, canonical_name, parent_id) values
  -- ── Categories (parent_id null) ──────────────────────────────────────────
  ('languages',      'Languages',                 null),
  ('frontend',       'Frontend',                  null),
  ('backend',        'Backend & Frameworks',      null),
  ('mobile',         'Mobile',                    null),
  ('databases',      'Databases & Storage',       null),
  ('infrastructure', 'Cloud & Infrastructure',    null),
  ('sysadmin',       'Systems Administration',    null),
  ('data-ml',        'Data, ML & AI',              null),
  ('ai-tooling',     'AI Tooling & Agentic Dev',   null),
  ('platforms',      'Platforms & Deployment',    null),
  ('systems',        'Systems & Low-Level',       null),
  ('web-apis',       'Web Fundamentals & APIs',   null),
  ('testing',        'Testing & Quality',         null),
  ('security',       'Security',                  null),
  -- Restored, narrowly: Product Management and User Research stay cut (no
  -- plausible detection path even later), but Figma and UI/UX Design are
  -- necessary skills for real student work regardless of whether the
  -- scanner can currently see them. Detection mechanism is genuinely
  -- unresolved — deferred by decision, not solved. See the leaf list below
  -- Security for the explicit TBD note.
  ('design',         'Design & Product',          null),
  ('game-dev',       'Game, Graphics & Robotics', null),
  ('blockchain',     'Blockchain & Web3',         null),

  -- ── Languages ─────────────────────────────────────────────────────────
  ('javascript',   'JavaScript',   'languages'),
  ('typescript',   'TypeScript',   'languages'),
  ('python',       'Python',       'languages'),
  ('java',         'Java',         'languages'),
  ('cpp',          'C++',          'languages'),
  ('c',            'C',            'languages'),
  ('go',           'Go',           'languages'),
  ('rust',         'Rust',         'languages'),
  ('swift',        'Swift',        'languages'),
  ('kotlin',       'Kotlin',       'languages'),
  ('ruby',         'Ruby',         'languages'),
  ('php',          'PHP',          'languages'),
  ('sql',          'SQL',          'languages'),
  ('scala',        'Scala',        'languages'),
  ('elixir',       'Elixir',       'languages'),
  ('haskell',      'Haskell',      'languages'),
  ('lua',          'Lua',          'languages'),
  ('dart',         'Dart',         'languages'),
  ('assembly',     'Assembly',     'languages'),
  ('r-lang',       'R',            'languages'),
  ('matlab',       'MATLAB',       'languages'),
  ('julia',        'Julia',        'languages'),
  ('objective-c',  'Objective-C',  'languages'),

  -- ── Frontend ──────────────────────────────────────────────────────────
  ('react',            'React',                    'frontend'),
  ('vue',              'Vue',                      'frontend'),
  ('angular',          'Angular',                  'frontend'),
  ('nextjs',           'Next.js',                  'frontend'),
  ('svelte',           'Svelte',                   'frontend'),
  ('html-css',         'HTML/CSS',                 'frontend'),
  ('tailwind-css',     'Tailwind CSS',             'frontend'),
  ('remix',            'Remix',                    'frontend'),
  ('astro',            'Astro',                    'frontend'),
  ('nuxt',             'Nuxt',                     'frontend'),
  ('web-accessibility','Web Accessibility',        'frontend'),
  ('pwa',              'Progressive Web Apps',     'frontend'),
  ('state-management', 'State Management',        'frontend'),
  -- Detectable via .storybook/ config, design-token files, or a dedicated
  -- component-library package structure — moved here from the (now-cut)
  -- Design & Product category, where every sibling node had no code
  -- footprint at all. This one does.
  ('design-systems',   'Design Systems',           'frontend'),
  ('vite',              'Vite',                     'frontend'), -- vite.config.js/.ts presence — strong signal. Missing from the original draft; surfaced by mapping the one real production listing.

  -- ── Backend & Frameworks ──────────────────────────────────────────────
  ('nodejs',        'Node.js',                'backend'),
  ('express',       'Express',                'backend'),
  ('django',        'Django',                 'backend'),
  ('flask',         'Flask',                  'backend'),
  ('fastapi',       'FastAPI',                'backend'),
  ('spring',        'Spring',                 'backend'),
  ('dotnet',        '.NET',                   'backend'),
  ('nestjs',        'NestJS',                 'backend'),
  ('laravel',       'Laravel',                'backend'),
  ('message-queues','Message Queues',         'backend'),
  ('microservices', 'Microservices Architecture', 'backend'),
  ('serverless',    'Serverless Architecture','backend'),

  -- ── Mobile ────────────────────────────────────────────────────────────
  ('react-native',       'React Native',        'mobile'),
  ('flutter',            'Flutter',             'mobile'),
  ('ios-development',    'iOS Development',     'mobile'),
  ('android-development','Android Development', 'mobile'),
  ('swiftui',            'SwiftUI',             'mobile'),
  ('jetpack-compose',    'Jetpack Compose',     'mobile'),

  -- ── Databases & Storage ───────────────────────────────────────────────
  ('postgresql',      'PostgreSQL',             'databases'),
  ('mysql',           'MySQL',                  'databases'),
  ('mongodb',         'MongoDB',                'databases'),
  ('redis',           'Redis',                  'databases'),
  ('sqlite',          'SQLite',                 'databases'),
  ('dynamodb',        'DynamoDB',               'databases'),
  ('elasticsearch',   'Elasticsearch',          'databases'),
  ('cassandra',       'Cassandra',              'databases'),
  ('neo4j',           'Neo4j / Graph Databases','databases'),
  ('data-warehousing','Data Warehousing',       'databases'),
  ('database-design', 'Database Design',        'databases'),

  -- ── Cloud & Infrastructure ────────────────────────────────────────────
  ('aws',           'AWS',                        'infrastructure'),
  ('gcp',           'Google Cloud Platform',      'infrastructure'),
  ('azure',         'Azure',                      'infrastructure'),
  ('docker',        'Docker',                     'infrastructure'),
  ('kubernetes',    'Kubernetes',                 'infrastructure'),
  ('ci-cd',         'CI/CD',                      'infrastructure'),
  ('linux-admin',   'Linux/Unix Administration',  'infrastructure'),
  ('terraform',     'Terraform / IaC',            'infrastructure'),
  ('load-balancing','Load Balancing & Networking Infra', 'infrastructure'),
  -- Site Reliability Engineering cut: a role/practice, not a technology —
  -- no artifact distinguishes it from Monitoring & Observability, which
  -- already covers its one genuinely detectable piece (Prometheus/Grafana
  -- config, OpenTelemetry imports).

  -- ── Systems Administration ───────────────────────────────────────────
  -- Half of this category got cut. Server hardening, log management,
  -- Windows Server, and Active Directory are real skills, but they're
  -- operational — performed against live infrastructure, rarely leaving a
  -- version-controlled artifact a scanner could find. Log management in
  -- particular is nearly indistinguishable from "uses a logging library,"
  -- which almost every project does regardless of skill — too low-signal
  -- to be its own claim.
  ('shell-scripting',      'Shell Scripting / Bash',      'sysadmin'),
  ('config-management',    'Configuration Management',    'sysadmin'),
  ('monitoring-observability', 'Monitoring & Observability', 'sysadmin'),
  ('virtualization',       'Virtualization & Hypervisors', 'sysadmin'),

  -- ── Data, ML & AI ─────────────────────────────────────────────────────
  ('pandas',              'Pandas',                       'data-ml'),
  ('numpy',               'NumPy',                        'data-ml'),
  ('machine-learning',    'Machine Learning',              'data-ml'),
  ('deep-learning',       'Deep Learning',                'data-ml'),
  ('tensorflow',          'TensorFlow',                    'data-ml'),
  ('pytorch',             'PyTorch',                       'data-ml'),
  ('nlp',                 'Natural Language Processing',  'data-ml'),
  ('computer-vision',     'Computer Vision',               'data-ml'),
  ('data-pipelines',      'Data Pipelines / ETL',         'data-ml'),
  ('reinforcement-learning', 'Reinforcement Learning',    'data-ml'),
  ('statistical-modeling','Statistical Modeling',         'data-ml'),
  ('time-series-analysis','Time Series Analysis',         'data-ml'),
  ('ab-testing',          'A/B Testing & Experimentation','data-ml'),
  ('big-data',            'Big Data (Spark/Hadoop)',      'data-ml'),
  ('mlops',               'MLOps',                        'data-ml'),
  ('feature-engineering', 'Feature Engineering',          'data-ml'),
  ('recommender-systems', 'Recommender Systems',          'data-ml'),
  ('speech-recognition',  'Speech Recognition',           'data-ml'),
  ('bioinformatics',      'Bioinformatics',               'data-ml'),

  -- ── AI Tooling & Agentic Dev ──────────────────────────────────────────
  -- Kept every node here despite weaker signals than the rest of the
  -- taxonomy, because the alternative is pretending your userbase's most
  -- common real work doesn't exist. Detection mechanism noted per node —
  -- Phase 1's scanner needs a bespoke heuristic for each, not a generic
  -- manifest read, since these mostly aren't standard dependency imports.
  ('prompt-engineering', 'Prompt Engineering',              'ai-tooling'), -- weakest signal in the taxonomy: no package to import. Heuristic only — long system-prompt string literals, dedicated prompt-template files/functions. Flag low-confidence until proven out.
  ('agentic-ai',         'Agentic AI / Tool Use',           'ai-tooling'), -- anthropic/openai SDK usage combined with tool-use / function-calling code patterns, or an agent framework import (crewai, autogen, langgraph)
  ('langchain',          'LangChain',                       'ai-tooling'), -- direct package import — strong signal
  ('rag',                'Retrieval-Augmented Generation (RAG)', 'ai-tooling'), -- vector-db client + retrieval-chain code pattern (langchain RAG chain, llama-index)
  ('claude-code',        'Claude Code',                     'ai-tooling'), -- CLAUDE.md file and/or .claude/ directory present in the repo — this is a real, checkable artifact
  ('github-copilot',     'GitHub Copilot',                  'ai-tooling'), -- weak: best available signal is .github/copilot-instructions.md presence; Copilot itself (IDE autocomplete) leaves no artifact
  ('cursor-ai',          'Cursor',                          'ai-tooling'), -- .cursor/rules or .cursorrules file present — real, checkable artifact
  ('vector-databases',   'Vector Databases & Embeddings',   'ai-tooling'), -- pinecone/weaviate/qdrant/chroma client import — strong signal
  ('fine-tuning',        'Fine-Tuning & Model Adaptation',  'ai-tooling'), -- LoRA/PEFT imports, training config files referencing a base model

  -- ── Platforms & Deployment ────────────────────────────────────────────
  -- Distinct from Cloud & Infrastructure: those are the general-purpose
  -- providers (AWS/GCP/Azure/Docker/K8s); these are specific hosted
  -- platforms/services a project integrates with directly. Firebase moved
  -- here rather than Databases — it's a full BaaS (auth + db + hosting +
  -- functions), not just a datastore.
  ('vercel',            'Vercel',                          'platforms'),
  ('netlify',           'Netlify',                         'platforms'),
  ('render',            'Render',                          'platforms'),
  ('railway',           'Railway',                         'platforms'),
  ('flyio',             'Fly.io',                          'platforms'),
  ('heroku',            'Heroku',                          'platforms'),
  ('cloudflare',        'Cloudflare (Workers/Pages)',      'platforms'),
  ('supabase-platform', 'Supabase',                        'platforms'),
  ('firebase',          'Firebase',                        'platforms'),
  ('posthog',           'PostHog',                         'platforms'),
  ('stripe-integration','Stripe (Payments Integration)',   'platforms'),
  ('auth-platforms',    'Authentication Platforms (Auth0, Clerk, etc.)', 'platforms'),
  ('sentry',            'Sentry / Error Monitoring',       'platforms'),
  ('twilio',            'Twilio / Messaging APIs',         'platforms'),
  ('email-delivery',    'Email Delivery (SendGrid, Resend, Postmark)', 'platforms'),

  -- ── Systems & Low-Level ───────────────────────────────────────────────
  ('distributed-systems', 'Distributed Systems',          'systems'),
  ('operating-systems',   'Operating Systems',            'systems'),
  ('networking',          'Networking',                   'systems'),
  ('concurrency',         'Concurrency & Parallelism',    'systems'),
  ('embedded-systems',    'Embedded Systems',             'systems'),
  ('cuda',                'CUDA / GPU Programming',       'systems'),
  ('compilers',           'Compilers & Language Design',  'systems'),
  ('kernel-development',  'Kernel Development',           'systems'),
  -- Memory Management cut: too diffuse to isolate as its own signal
  -- separate from "wrote C/C++/Rust" — a custom allocator is a narrow
  -- special case, not a general detector. What it was pointing at is
  -- better captured under Performance-Optimized C++ below.
  ('performance-cpp',     'Performance-Optimized C++',    'systems'),
  ('real-time-systems',   'Real-Time Systems',            'systems'),
  ('formal-verification', 'Formal Verification',          'systems'),
  ('quantum-computing',   'Quantum Computing',            'systems'),

  -- ── Web Fundamentals & APIs ───────────────────────────────────────────
  ('rest-apis',  'REST APIs',                    'web-apis'),
  ('graphql',    'GraphQL',                      'web-apis'),
  ('websockets', 'WebSockets',                   'web-apis'),
  ('api-design', 'API Design & Documentation',   'web-apis'),
  ('webassembly','WebAssembly',                  'web-apis'),
  ('i18n',       'Internationalization & Localization', 'web-apis'),

  -- ── Testing & Quality ─────────────────────────────────────────────────
  ('unit-testing',       'Unit Testing',            'testing'),
  ('e2e-testing',        'End-to-End Testing',      'testing'),
  ('integration-testing','Integration Testing',     'testing'),
  ('performance-testing','Performance & Load Testing', 'testing'),
  -- Test-Driven Development cut: a methodology (write the test before the
  -- code), not an artifact a snapshot scan can see. "Has tests" is already
  -- fully captured by Unit/E2E/Integration Testing above. Distinguishing
  -- TDD specifically would need commit-order analysis (was the test
  -- committed before the implementation?) — a real signal, but one that
  -- needs git-history mining the scanner doesn't do yet. Worth revisiting
  -- once it does.

  -- ── Security ──────────────────────────────────────────────────────────
  ('app-security',       'Application Security', 'security'),
  ('cryptography',       'Cryptography',         'security'),
  -- Penetration Testing cut: it's performed AGAINST a target system, so
  -- artifacts land in the target's repo, if anywhere — not the
  -- practitioner's. A repo of someone's own scanning tools would register
  -- as Application Security or general scripting, not this.
  ('network-security',   'Network Security',     'security'),
  ('iam',                'Identity & Access Management', 'security'),

  -- ── Design & Product ──────────────────────────────────────────────────
  -- Product Management and User Research stay cut — no plausible
  -- detection path exists even in principle; they're pure process/role
  -- skills with zero artifact. Figma and UI/UX Design are different: kept
  -- because they're necessary for real student work (design collaborators
  -- are a real part of this marketplace) even though NO detection
  -- mechanism exists yet. This is a genuine gap, deferred by decision, not
  -- solved — these will presumably need either a Figma-file-link field
  -- captured outside the scanner entirely, or attestation once Tier 1+
  -- exists. Don't build detection logic for these in Phase 1 without
  -- revisiting this note first.
  ('ui-ux-design', 'UI/UX Design', 'design'),  -- TBD: no detection mechanism yet
  ('figma',        'Figma',        'design'),  -- TBD: no detection mechanism yet

  -- ── Game, Graphics & Robotics ─────────────────────────────────────────
  ('unity',                 'Unity',                        'game-dev'),
  ('unreal-engine',         'Unreal Engine',                'game-dev'),
  ('godot',                 'Godot',                        'game-dev'),
  -- Game Design cut: the creative/conceptual practice (mechanics, level
  -- design), not the engine work. No artifact distinguishes it from just
  -- "used Unity/Godot" — level-data files are an engine-project signal,
  -- not a design-skill one.
  ('graphics-programming',  '3D Graphics Programming',      'game-dev'),
  ('shader-programming',    'Shader Programming',           'game-dev'),
  ('physics-simulation',    'Physics Simulation',           'game-dev'),
  ('multiplayer-networking','Multiplayer Networking',       'game-dev'),
  ('ar-development',        'Augmented Reality Development','game-dev'),
  ('vr-development',        'Virtual Reality Development',  'game-dev'),
  ('robotics',              'Robotics',                     'game-dev'),
  ('cad',                   'Computer-Aided Design (CAD)',  'game-dev'),

  -- ── Blockchain & Web3 ─────────────────────────────────────────────────
  ('solidity',               'Solidity',                'blockchain'),
  -- Detectable via hardhat.config.js / truffle-config.js / foundry.toml —
  -- distinct signal from Solidity itself (shows deployment/testing
  -- tooling, not just the language).
  ('smart-contracts',        'Smart Contracts',         'blockchain')
  -- Blockchain Architecture cut: too abstract to isolate — Solidity plus
  -- Smart Contracts tooling already captures everything detectable here.

on conflict (id) do nothing;
