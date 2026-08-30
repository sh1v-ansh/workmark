# Workmark — Setup & Deploy Guide

Student-to-student marketplace MVP. Next.js 14 (App Router) + Supabase + a GitHub
**App** for repo evidence, with optional Claude agents (Anthropic), Voyage embeddings,
and Resend email.

> This guide matches the current code. An older version described a GitHub **OAuth**
> app and routes like `/projects` / `/company/dashboard` / `/api/verify` — none of
> that exists anymore. The current integration is a **GitHub App**
> (`/api/github/app/install` → GitHub → `/api/github/app/callback`), and env vars are
> the ones under §4.

---

## 0. Prerequisites

- **Node.js 22 LTS or newer.** The app *runs* on Node 20, but `@supabase/supabase-js`
  warns on 20, and the test runner (vitest 4 / rolldown) **requires Node ≥ 22** — it
  crashes at startup on Node 20. Use `nvm install 22 && nvm use 22` or `brew install node@22`.
- A Supabase project (free tier is fine).
- A GitHub App (created below).
- Accounts for Voyage (required) and, optionally, Anthropic + Resend.

---

## 1. Supabase setup

### 1a. Create the project
supabase.com → New Project. From **Project Settings → API**, copy the **Project URL**,
the **anon** (publishable) key, and the **service_role** (secret) key.

### 1b. Run the schema
**SQL Editor** → paste and run all of `supabase/schema.sql`. This creates every table
(students, listings, applications, engagements, skill_evidence, consents,
disclosure_log, evidence_audit, agent_calls, review_requests, disputes, …), RLS
policies, and the private `resumes` storage bucket.

> `schema.sql` is the source of truth and is destructive (it drops legacy tables). Since
> MVP hasn't shipped with real user data, re-running it is safe. Make future changes as
> new `supabase/migrations/000N_*.sql` files, not by editing `schema.sql` in place.

### 1c. Seed the skill taxonomy
Matching needs a skill taxonomy with embeddings, or fit/scan features have nothing to
work against:
1. SQL Editor → run `supabase/seed_skills_taxonomy.sql`.
2. Then locally (after §4): `node --env-file=.env.local scripts/backfill-taxonomy-embeddings.mjs`
   (needs `VOYAGE_API_KEY`).

### 1d. Configure Auth
- **Auth → URL Configuration → Redirect URLs** — add `http://localhost:3000/auth/confirmed`
  (and your production `https://<domain>/auth/confirmed`).
- **Auth → Email** — enable **Confirm email**. The `.edu` restriction is enforced in the
  sign-up UI and the onboarding form; email confirmation is what makes it meaningful.

---

## 2. GitHub App (repo evidence)

Create at github.com/settings/apps → **New GitHub App**.

- **Homepage URL:** your site URL (e.g. `http://localhost:3000`)
- **Callback / Setup URL:** `http://localhost:3000/api/github/app/callback`
  (prod: `https://<domain>/api/github/app/callback`)
- **Webhook → Active:** on. **Webhook URL:** `http://localhost:3000/api/github/app/webhook`
  and set a **Webhook secret**.
  - Localhost can't receive real webhook deliveries — for local testing you can point the
    webhook at a tunnel (`ngrok`, `cloudflared`) or leave it; on-demand repo scanning and
    deployment verification work without inbound webhooks. The secret is still **required**
    (the app won't initialize without `GITHUB_APP_WEBHOOK_SECRET`).
- **Repository permissions:** Contents → **Read-only**, Metadata → **Read-only**,
  Deployments → **Read-only**. (The scanner reads manifest files and deployment records;
  it never reads source.)
- After creating: note the **App ID**; **Generate a private key** (downloads a `.pem`);
  copy the app's URL **slug** (from `github.com/apps/<slug>`).

---

## 3. Other API keys

- **Voyage (required):** voyageai.com → API key → `VOYAGE_API_KEY`. Powers skill embeddings.
- **Anthropic (optional):** console.anthropic.com → API key → `ANTHROPIC_API_KEY`. Enables
  the poster "Draft it for me" listing assistant and cold-start project briefs. Without it,
  those features are hidden and the app still runs. (Agent model: `claude-opus-4-8`.)
- **Resend (optional):** resend.com → API key → `RESEND_API_KEY`, plus `EMAIL_FROM`
  (a verified sender, e.g. `Workmark <notify@your-domain>`). Enables notification emails
  (application received/accepted, work submitted, engagement closed). Without both, email
  is silently skipped.

---

## 4. Environment variables

Copy the template and fill it in (never commit `.env.local` — it's git-ignored):

```bash
cp .env.example .env.local
```

Variables the code actually reads:

```
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...            # secret — full DB access, server-only

# Site (required)
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Voyage embeddings (required)
VOYAGE_API_KEY=

# GitHub App (required for repo scanning)
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=                      # full .pem; escaped \n between lines is OK
GITHUB_APP_WEBHOOK_SECRET=
GITHUB_APP_SLUG=

# Background worker + cron (required)
# Without this, GitHub scans are queued but never run: kickJob() refuses to
# fire, and /api/jobs/step and /api/cron/jobs both return 500 "not configured".
# Generate with: openssl rand -hex 32
# On Vercel, set it in project env vars — Vercel Cron sends it automatically
# as `Authorization: Bearer $CRON_SECRET`.
CRON_SECRET=

# Optional
ANTHROPIC_API_KEY=
RESEND_API_KEY=
EMAIL_FROM=
```

`GITHUB_APP_PRIVATE_KEY`: paste the whole PEM. If your env tooling can't hold real
newlines, replace them with literal `\n` — `src/lib/github/app.ts` un-escapes them.

---

## 5. Local development

```bash
npm install
npm run dev          # http://localhost:3000
```

Optional demo data: `node --env-file=.env.local scripts/seed-demo-students.mjs` and
`scripts/seed-github-skills.mjs`.

---

## 6. Human-review queue (CLI)

Demos that aren't machine-checkable land in `review_requests` (submitted from
`/student/github`). Review them with the service-role CLI:

```bash
node --env-file=.env.local scripts/review-queue.mjs                 # list pending
node --env-file=.env.local scripts/review-queue.mjs approve <id> "note"
node --env-file=.env.local scripts/review-queue.mjs reject  <id> "reason"
```

Approving writes an artifact with `verification_method = 'human_review'`; rejection
requires a reason, which the student sees.

---

## 7. Tests

```bash
npm test             # vitest — requires Node >= 22 (see §0)
```

Pure unit tests (no DB/credentials): schema-consistency, depth, fit, goals, lifecycle,
disputes, manifests, profile, agents.

---

## 8. Deploy to Vercel

1. Push to GitHub and import the repo at vercel.com → New Project.
2. Add every variable from §4 under **Settings → Environment Variables** (set
   `NEXT_PUBLIC_SITE_URL` to the production URL).
3. Update the GitHub App's Callback and Webhook URLs to the production domain, and add
   `https://<domain>/auth/confirmed` to Supabase's redirect allow-list.
4. Deploy.

---

## 9. Optional: attestation emails Edge Function

`supabase/functions/send-verification-emails/` is a Deno Edge Function for the deferred
company/faculty work-record attestation flow — not part of the core student MVP. Deploy
only if you need it:

```bash
npm i -g supabase
supabase login && supabase link --project-ref <REF>
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... SITE_URL=https://<domain> RESEND_API_KEY=re_...
supabase functions deploy send-verification-emails --no-verify-jwt
```

Schedule via pg_cron (see the commented block at the bottom of `schema.sql`) or any
external cron hitting `POST /functions/v1/send-verification-emails`.

---

## Route map (current)

```
/                         Landing
/login                    Sign in / sign up (.edu enforced)
/auth/confirmed           Post email-confirmation landing
/onboarding               Student profile creation (redirects to dashboard if already onboarded)
/student/dashboard        Student home
/student/github           Connect GitHub, manage repo scan opt-in, submit review requests
/listings                 Browse open projects (fit-ranked; multi-select filter)
/listings/new             Poster agent → draft → approve → publish
/listings/[id]            Detail + structured application
/listings/[id]/applicants Ranked applicants (poster view)
/engagements/[id]         Engagement lifecycle
/goals  /me/briefs        Student goal agent + cold-start briefs
/me  /me/file  /me/disputes  Public record, FCRA file disclosure, disputes
/students                 Scoped student directory
/p/[handle]               Public verified profile
/api/github/app/{install,callback,webhook}   GitHub App flow
/api/github/{scan,repos/sync}                Scanning
/api/applications[...]  /api/engagements/[id][...]  /api/agents/{brief,listing-assist}  …
```

## Security notes

- Browser DB access uses the anon key + RLS. The service-role key is used only in
  server API routes and scripts — never in client components.
- GitHub App auth is installation-scoped; `github_connections` stores the
  `installation_id`, not a long-lived token.
- Private-repo scanning requires an explicit per-repo opt-in — being granted a repo is
  not consent to scan it.
