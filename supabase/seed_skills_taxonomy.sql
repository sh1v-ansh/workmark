-- ============================================================
--  WORKMARK — Canonical skill taxonomy seed (Phase 0, draft for review)
--
--  80 nodes: 12 category parents + 68 claimable leaf skills. Categories
--  exist for canonicalization/UI grouping (e.g. grouping an autocomplete,
--  or giving the embedding model useful neighbors) — students and posters
--  almost always claim/require a leaf, not a category.
--
--  id is a stable text slug, not a uuid. Every other table in this schema
--  uses uuid primary keys, but this one table is a fixed, hand-authored
--  vocabulary referenced directly in code (skill_aliases, matching,
--  seed data) — a slug is what you want to type in a WHERE clause, and it
--  means this file *is* the taxonomy, not a lookup table you re-derive from
--  it. Every other table stays uuid.
--
--  embedding is left null here. It's populated by a one-time backfill
--  script once a Voyage API key exists (Phase 1) — the taxonomy itself
--  doesn't depend on embeddings to exist, only canonicalization does.
--
--  EDIT THIS LIST. Add/remove/rename before it's run — once listings and
--  evidence reference these ids, renaming a skill means a migration, not
--  a text edit.
-- ============================================================

insert into skills (id, canonical_name, parent_id) values
  -- ── Categories (parent_id null) ──────────────────────────────────────────
  ('languages',      'Languages',                 null),
  ('frontend',       'Frontend',                  null),
  ('backend',        'Backend & Frameworks',      null),
  ('mobile',         'Mobile',                    null),
  ('databases',      'Databases & Storage',       null),
  ('infrastructure', 'Cloud & Infrastructure',    null),
  ('data-ml',        'Data, ML & AI',              null),
  ('systems',        'Systems & Low-Level',       null),
  ('web-apis',       'Web Fundamentals & APIs',   null),
  ('testing',        'Testing & Quality',         null),
  ('security',       'Security',                  null),
  ('design',         'Design & Product',          null),

  -- ── Languages ─────────────────────────────────────────────────────────
  ('javascript',  'JavaScript',  'languages'),
  ('typescript',  'TypeScript',  'languages'),
  ('python',      'Python',      'languages'),
  ('java',        'Java',        'languages'),
  ('cpp',         'C++',         'languages'),
  ('c',           'C',           'languages'),
  ('go',          'Go',          'languages'),
  ('rust',        'Rust',        'languages'),
  ('swift',       'Swift',       'languages'),
  ('kotlin',      'Kotlin',      'languages'),
  ('ruby',        'Ruby',        'languages'),
  ('php',         'PHP',         'languages'),
  ('sql',         'SQL',         'languages'),

  -- ── Frontend ──────────────────────────────────────────────────────────
  ('react',         'React',         'frontend'),
  ('vue',           'Vue',           'frontend'),
  ('angular',       'Angular',       'frontend'),
  ('nextjs',        'Next.js',       'frontend'),
  ('svelte',        'Svelte',        'frontend'),
  ('html-css',      'HTML/CSS',      'frontend'),
  ('tailwind-css',  'Tailwind CSS',  'frontend'),

  -- ── Backend & Frameworks ──────────────────────────────────────────────
  ('nodejs',   'Node.js',  'backend'),
  ('express',  'Express',  'backend'),
  ('django',   'Django',   'backend'),
  ('flask',    'Flask',    'backend'),
  ('fastapi',  'FastAPI',  'backend'),
  ('spring',   'Spring',   'backend'),
  ('dotnet',   '.NET',     'backend'),

  -- ── Mobile ────────────────────────────────────────────────────────────
  ('react-native',      'React Native',        'mobile'),
  ('flutter',           'Flutter',             'mobile'),
  ('ios-development',   'iOS Development',     'mobile'),
  ('android-development','Android Development','mobile'),

  -- ── Databases & Storage ───────────────────────────────────────────────
  ('postgresql', 'PostgreSQL', 'databases'),
  ('mysql',      'MySQL',      'databases'),
  ('mongodb',    'MongoDB',    'databases'),
  ('redis',      'Redis',      'databases'),
  ('sqlite',     'SQLite',     'databases'),
  ('dynamodb',   'DynamoDB',   'databases'),

  -- ── Cloud & Infrastructure ────────────────────────────────────────────
  ('aws',           'AWS',                        'infrastructure'),
  ('gcp',           'Google Cloud Platform',      'infrastructure'),
  ('azure',         'Azure',                      'infrastructure'),
  ('docker',        'Docker',                     'infrastructure'),
  ('kubernetes',    'Kubernetes',                 'infrastructure'),
  ('ci-cd',         'CI/CD',                      'infrastructure'),
  ('linux-admin',   'Linux/Unix Administration',  'infrastructure'),

  -- ── Data, ML & AI ─────────────────────────────────────────────────────
  ('pandas',        'Pandas',                     'data-ml'),
  ('numpy',         'NumPy',                      'data-ml'),
  ('machine-learning','Machine Learning',         'data-ml'),
  ('deep-learning', 'Deep Learning',              'data-ml'),
  ('tensorflow',    'TensorFlow',                 'data-ml'),
  ('pytorch',       'PyTorch',                    'data-ml'),
  ('nlp',           'Natural Language Processing','data-ml'),
  ('computer-vision','Computer Vision',           'data-ml'),
  ('data-pipelines','Data Pipelines / ETL',       'data-ml'),

  -- ── Systems & Low-Level ───────────────────────────────────────────────
  ('distributed-systems','Distributed Systems',          'systems'),
  ('operating-systems',  'Operating Systems',            'systems'),
  ('networking',         'Networking',                   'systems'),
  ('concurrency',        'Concurrency & Parallelism',    'systems'),
  ('embedded-systems',   'Embedded Systems',             'systems'),
  ('cuda',               'CUDA / GPU Programming',       'systems'),

  -- ── Web Fundamentals & APIs ───────────────────────────────────────────
  ('rest-apis',   'REST APIs',   'web-apis'),
  ('graphql',     'GraphQL',     'web-apis'),
  ('websockets',  'WebSockets',  'web-apis'),

  -- ── Testing & Quality ─────────────────────────────────────────────────
  ('unit-testing', 'Unit Testing',      'testing'),
  ('e2e-testing',  'End-to-End Testing','testing'),

  -- ── Security ──────────────────────────────────────────────────────────
  ('app-security', 'Application Security', 'security'),
  ('cryptography', 'Cryptography',         'security'),

  -- ── Design & Product ──────────────────────────────────────────────────
  ('ui-ux-design', 'UI/UX Design', 'design'),
  ('figma',        'Figma',        'design')

on conflict (id) do nothing;
