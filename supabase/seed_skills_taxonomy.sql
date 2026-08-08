-- ============================================================
--  WORKMARK — Canonical skill taxonomy seed (Phase 0, draft for review)
--
--  16 category parents + ~163 claimable leaf skills. Categories exist for
--  canonicalization/UI grouping — students and posters almost always
--  claim/require a leaf, not a category.
--
--  This deliberately exceeds the original "60-80 nodes" guidance in the
--  product spec — broader coverage was requested explicitly (website dev,
--  game dev, systems dev, sysadmin, AI/data science, niche areas) over the
--  original "don't explode into five thousand tags" ceiling. Still a
--  curated, hand-authored list, not an open tag cloud.
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
  ('systems',        'Systems & Low-Level',       null),
  ('web-apis',       'Web Fundamentals & APIs',   null),
  ('testing',        'Testing & Quality',         null),
  ('security',       'Security',                  null),
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
  ('web-performance',  'Web Performance Optimization', 'frontend'),

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
  ('mobile-performance', 'Mobile App Performance', 'mobile'),

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
  ('sre',           'Site Reliability Engineering','infrastructure'),

  -- ── Systems Administration ───────────────────────────────────────────
  ('shell-scripting',      'Shell Scripting / Bash',      'sysadmin'),
  ('config-management',    'Configuration Management',    'sysadmin'),
  ('server-hardening',     'Server Hardening & Security', 'sysadmin'),
  ('monitoring-observability', 'Monitoring & Observability', 'sysadmin'),
  ('log-management',       'Log Management',              'sysadmin'),
  ('virtualization',       'Virtualization & Hypervisors', 'sysadmin'),
  ('windows-server-admin', 'Windows Server Administration','sysadmin'),
  ('active-directory',     'Active Directory',            'sysadmin'),

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
  ('prompt-engineering', 'Prompt Engineering',              'ai-tooling'),
  ('agentic-ai',         'Agentic AI / Tool Use',           'ai-tooling'),
  ('langchain',          'LangChain',                       'ai-tooling'),
  ('rag',                'Retrieval-Augmented Generation (RAG)', 'ai-tooling'),
  ('claude-code',        'Claude Code',                     'ai-tooling'),
  ('claude-design',      'Claude Design',                   'ai-tooling'),
  ('github-copilot',     'GitHub Copilot',                  'ai-tooling'),
  ('cursor-ai',          'Cursor',                          'ai-tooling'),
  ('vector-databases',   'Vector Databases & Embeddings',   'ai-tooling'),
  ('fine-tuning',        'Fine-Tuning & Model Adaptation',  'ai-tooling'),

  -- ── Systems & Low-Level ───────────────────────────────────────────────
  ('distributed-systems', 'Distributed Systems',          'systems'),
  ('operating-systems',   'Operating Systems',            'systems'),
  ('networking',          'Networking',                   'systems'),
  ('concurrency',         'Concurrency & Parallelism',    'systems'),
  ('embedded-systems',    'Embedded Systems',             'systems'),
  ('cuda',                'CUDA / GPU Programming',       'systems'),
  ('compilers',           'Compilers & Language Design',  'systems'),
  ('kernel-development',  'Kernel Development',           'systems'),
  ('memory-management',   'Memory Management',            'systems'),
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
  ('tdd',                'Test-Driven Development', 'testing'),

  -- ── Security ──────────────────────────────────────────────────────────
  ('app-security',       'Application Security', 'security'),
  ('cryptography',       'Cryptography',         'security'),
  ('penetration-testing','Penetration Testing',  'security'),
  ('network-security',   'Network Security',     'security'),
  ('iam',                'Identity & Access Management', 'security'),

  -- ── Design & Product ──────────────────────────────────────────────────
  ('ui-ux-design',     'UI/UX Design',        'design'),
  ('figma',            'Figma',               'design'),
  ('product-management','Product Management', 'design'),
  ('user-research',    'User Research',       'design'),
  ('design-systems',   'Design Systems',      'design'),

  -- ── Game, Graphics & Robotics ─────────────────────────────────────────
  ('unity',                 'Unity',                        'game-dev'),
  ('unreal-engine',         'Unreal Engine',                'game-dev'),
  ('godot',                 'Godot',                        'game-dev'),
  ('game-design',           'Game Design',                  'game-dev'),
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
  ('smart-contracts',        'Smart Contracts',         'blockchain'),
  ('blockchain-architecture','Blockchain Architecture', 'blockchain')

on conflict (id) do nothing;
