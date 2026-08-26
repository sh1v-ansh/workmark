import { describe, it, expect } from 'vitest'
import {
  extractImports, parseComposeServices, parseDockerfile, parseOrmConfig,
  parsePrismaSchema, parseSqlFile, parseTerraform, parseWorkflow,
} from '../src/lib/github/detectors'
import { manifestKindForPath, parseManifest } from '../src/lib/github/manifests'
import { planFiles } from '../src/lib/github/file-plan'
import { applyImplications } from '../src/lib/skills/implications'

const raws = (ds: { raw: string }[]) => ds.map((d) => d.raw)

describe('the Postgres case', () => {
  // The bug that started all of this: a repo genuinely using Postgres
  // recorded "Supabase" or "Prisma" and never Postgres itself. Each of
  // these is one of the ways that happened.

  it('finds Postgres from a compose service', () => {
    const compose = `
services:
  db:
    image: postgres:15-alpine
  cache:
    image: redis:7
`
    const found = raws(parseComposeServices(compose, 'docker-compose.yml'))
    expect(found).toContain('postgres')
    expect(found).toContain('redis')
  })

  it('finds Postgres from the Prisma datasource, not just "Prisma"', () => {
    const schema = `
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
model User { id Int @id }
`
    const found = raws(parsePrismaSchema(schema, 'prisma/schema.prisma'))
    expect(found).toContain('Prisma')
    expect(found).toContain('PostgreSQL')
  })

  it('finds Postgres from dialect-only SQL, with no driver anywhere', () => {
    const sql = `
create table jobs (
  id uuid primary key default gen_random_uuid(),
  steps jsonb not null
);
create index jobs_idx on jobs (id);
`
    const found = raws(parseSqlFile(sql, 'supabase/schema.sql'))
    expect(found).toContain('SQL')
    expect(found).toContain('PostgreSQL')
    expect(found).toContain('database schema design')
    expect(found).toContain('database indexing')
  })

  it('reaches Postgres and SQL from Supabase alone, through implications', () => {
    const { all } = applyImplications(['supabase-platform'])
    expect(all.has('postgresql')).toBe(true)
    // Chained: supabase -> postgresql -> sql, resolved in one call.
    expect(all.has('sql')).toBe(true)
  })

  it('records what caused an implied skill, for provenance', () => {
    const { causedBy } = applyImplications(['supabase-platform'])
    expect(causedBy.get('postgresql')).toBe('supabase-platform')
  })

  it('does not invent implications for an unknown skill', () => {
    const { all } = applyImplications(['some-skill-with-no-rule'])
    expect(Array.from(all)).toEqual(['some-skill-with-no-rule'])
  })
})

describe('parseDockerfile', () => {
  it('reports the base image, not just "Docker"', () => {
    const found = raws(parseDockerfile('FROM node:20-alpine\nRUN npm ci\n', 'Dockerfile'))
    expect(found).toContain('Docker')
    expect(found).toContain('node')
  })

  it('spots a multi-stage build', () => {
    const df = 'FROM golang:1.22 AS build\nFROM alpine:3\nCOPY --from=build /app /app\n'
    expect(raws(parseDockerfile(df, 'Dockerfile'))).toContain('multi-stage Docker build')
  })

  it('ignores scratch and build-arg indirection', () => {
    const found = raws(parseDockerfile('FROM scratch\nFROM $BASE_IMAGE\n', 'Dockerfile'))
    expect(found).not.toContain('scratch')
    expect(found.some((f) => f.startsWith('$'))).toBe(false)
  })
})

describe('parseOrmConfig', () => {
  it('reads the driver out of a drizzle config', () => {
    const cfg = `export default { dialect: "postgresql", schema: "./src/db" }`
    expect(raws(parseOrmConfig(cfg, 'drizzle.config.ts'))).toContain('PostgreSQL')
  })

  it('ignores a database named only in a comment', () => {
    const cfg = `// we used to be on postgres\nexport default { schema: "./src/db" }`
    expect(parseOrmConfig(cfg, 'drizzle.config.ts')).toEqual([])
  })
})

describe('parseTerraform / parseWorkflow', () => {
  it('names the cloud from a terraform resource prefix', () => {
    const tf = 'resource "aws_s3_bucket" "assets" {\n  bucket = "x"\n}'
    const found = raws(parseTerraform(tf, 'infra/main.tf'))
    expect(found).toContain('Terraform')
    expect(found).toContain('AWS')
  })

  it('reads what a workflow actually does', () => {
    const wf = `
jobs:
  test:
    strategy:
      matrix:
        node: [18, 20]
    steps:
      - uses: docker/build-push-action@v5
`
    const found = raws(parseWorkflow(wf, '.github/workflows/ci.yml'))
    expect(found).toContain('CI/CD')
    expect(found).toContain('CI matrix builds')
    expect(found).toContain('Docker')
  })
})

describe('extractImports', () => {
  it('pulls libraries out of JS/TS imports', () => {
    const src = `
import { useState } from 'react'
import ReactDOM from 'react-dom/client'
import { useQuery } from '@tanstack/react-query'
const fs = require('fs')
`
    const found = raws(extractImports(src, 'src/app.tsx'))
    expect(found).toContain('react')
    expect(found).toContain('react-dom')
    expect(found).toContain('@tanstack/react-query') // scope kept — it identifies the package
    expect(found).toContain('fs')
  })

  it('skips the project\'s own code', () => {
    const src = `import { helper } from './utils'\nimport { C } from '@/lib/theme'\n`
    expect(extractImports(src, 'src/app.ts')).toEqual([])
  })

  it('handles Python, C++, Rust and Java', () => {
    expect(raws(extractImports('import numpy as np\nfrom pandas import DataFrame\n', 'a.py')))
      .toEqual(expect.arrayContaining(['numpy', 'pandas']))
    expect(raws(extractImports('#include <torch/torch.h>\n', 'a.cpp'))).toContain('torch')
    expect(raws(extractImports('use tokio::runtime;\n', 'a.rs'))).toContain('tokio')
    expect(raws(extractImports('import java.util.concurrent.Executor;\n', 'A.java')))
      .toContain('java.util.concurrent.Executor')
  })
})

describe('manifest parsers for the previously-invisible ecosystems', () => {
  it('reads Maven artifact ids', () => {
    const pom = `
<dependencies>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
  </dependency>
</dependencies>`
    expect(parseManifest('pom.xml', pom)).toContain('spring-boot-starter-web')
  })

  it('reads Gradle in both DSLs, plus version catalogs', () => {
    const gradle = `
implementation 'com.squareup.retrofit2:retrofit:2.9.0'
testImplementation("org.junit.jupiter:junit-jupiter:5.10.0")
implementation libs.androidx.core
id 'org.springframework.boot'
`
    const found = parseManifest('build.gradle', gradle)
    expect(found).toContain('retrofit')
    expect(found).toContain('junit-jupiter')
    expect(found).toContain('androidx-core')
    expect(found).toContain('org.springframework.boot')
  })

  it('reads Gemfile, composer and csproj', () => {
    expect(parseManifest('Gemfile', "gem 'rails', '~> 7.0'\ngem \"puma\"\n")).toEqual(
      expect.arrayContaining(['rails', 'puma']),
    )
    // Both halves — "laravel" is the recognisable name here, "guzzle" is
    // the recognisable half of guzzlehttp/guzzle. Canonicalization picks.
    expect(parseManifest('composer.json', '{"require":{"php":"^8.1","laravel/framework":"^10.0"}}'))
      .toEqual(expect.arrayContaining(['laravel', 'framework']))
    expect(parseManifest('csproj', '<PackageReference Include="Newtonsoft.Json" Version="13.0.3" />'))
      .toContain('Newtonsoft.Json')
  })

  it('reads CMake, where a C++ repo previously yielded nothing at all', () => {
    const cmake = `
project(MyEngine)
find_package(OpenGL REQUIRED)
target_link_libraries(MyEngine PRIVATE glfw OpenGL::GL)
`
    const found = parseManifest('CMakeLists.txt', cmake)
    expect(found).toContain('OpenGL')
    expect(found).toContain('glfw')
    expect(found).not.toContain('MyEngine')  // the project's own name isn't a dependency
    expect(found).not.toContain('PRIVATE')   // nor is a CMake keyword
  })

  it('finds manifests in subdirectories, not only at the root', () => {
    expect(manifestKindForPath('services/api/package.json')).toBe('package.json')
    expect(manifestKindForPath('android/app/build.gradle.kts')).toBe('build.gradle')
    expect(manifestKindForPath('src/App.csproj')).toBe('csproj')
    expect(manifestKindForPath('src/index.ts')).toBeNull()
  })
})

describe('planFiles', () => {
  const blob = (path: string, size = 100) => ({ path, type: 'blob', size })

  it('picks the files worth reading and names the rest from their path', () => {
    const plan = planFiles([
      blob('package.json'),
      blob('docker-compose.yml'),
      blob('prisma/schema.prisma'),
      blob('migrations/001.sql'),
      blob('infra/main.tf'),
      blob('.github/workflows/ci.yml'),
      blob('k8s/deployment.yaml'),
      blob('api/service.proto'),
      blob('src/index.ts'),
    ])
    const kinds = plan.files.map((f) => f.plan.kind)
    expect(kinds).toEqual(expect.arrayContaining(['manifest', 'compose', 'prisma', 'sql', 'terraform', 'workflow']))
    expect(plan.presence.map((p) => p.raw)).toEqual(expect.arrayContaining(['Kubernetes', 'Protocol Buffers']))
    // Ordinary source isn't fetched by the plan — it comes from the
    // student's own touched files instead.
    expect(plan.files.some((f) => f.path === 'src/index.ts')).toBe(false)
  })

  it('ignores vendored trees', () => {
    const plan = planFiles([blob('node_modules/react/package.json'), blob('vendor/x/go.mod')])
    expect(plan.files).toEqual([])
  })

  it('caps a monorepo instead of fetching every manifest', () => {
    const many = Array.from({ length: 40 }, (_, i) => blob(`packages/p${i}/package.json`))
    const plan = planFiles(many)
    expect(plan.files.length).toBeLessThanOrEqual(12)
  })

  it('prefers the root manifest when the cap bites', () => {
    const plan = planFiles([
      ...Array.from({ length: 30 }, (_, i) => blob(`packages/deep/nested/p${i}/package.json`)),
      blob('package.json'),
    ])
    expect(plan.files.some((f) => f.path === 'package.json')).toBe(true)
  })

  it('skips files too large to be worth a regex pass', () => {
    const plan = planFiles([blob('huge.sql', 5_000_000)])
    expect(plan.files).toEqual([])
  })
})
