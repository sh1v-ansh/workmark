# Workmark — Deploy Guide

## 1. Supabase Setup

### 1a. Create a Supabase project
Go to https://supabase.com → New Project. Note your **project URL** and **anon key**
from **Settings → API**.

### 1b. Run the schema
In **Supabase → SQL Editor**, paste and run the full contents of `supabase/schema.sql`.

> **Note (v2 migration):** `schema.sql` is destructive — it drops the legacy
> `experience_records` table and installs the polymorphic poster model plus the
> spec §11.1 staging tables (`verified_work_records`, `milestones`, `issue_flags`,
> `github_evidenced_skills`, `employer_profiles`, and the `faculty` table). Since
> MVP has not shipped with real user data, re-running it is safe. Future
> incremental changes should be added as `supabase/migrations/000N_*.sql` files,
> never by editing `schema.sql` in place.

### 1c. Configure Auth
- **Settings → Auth → URL Configuration → Redirect URLs** — add
  `${NEXT_PUBLIC_SITE_URL}/auth/confirmed` to the allow-list so email
  confirmation redirects work.
- **Settings → Auth → Email** — enable "Confirm email" for production so
  the `.edu` enforcement is meaningful.
- The `.edu` restriction is enforced in the sign-up UI and the onboarding form.

### 1d. Storage
The schema creates the `resumes` private bucket automatically via SQL.
If it fails, create it manually:
- **Storage → New bucket** → name: `resumes`, toggle **Public** to OFF.

### 1e. GitHub OAuth (for Tier 3 skill extraction)
- **Settings → Auth → Providers → GitHub** → toggle **Enable**.
- Register an OAuth app at https://github.com/settings/developers with:
  - **Homepage URL:** your `NEXT_PUBLIC_SITE_URL`
  - **Authorization callback URL:** `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
- Paste the client ID + secret into Supabase.
- **Scopes:** `read:user public_repo` (the scanner never reads code — only manifest files).

---

## 2. Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...          # Settings → API → service_role (secret)
NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app

# Stripe Connect escrow — stays off until legal review (spec §10.3)
STRIPE_ENABLED=false
# STRIPE_SECRET_KEY=sk_test_...
# STRIPE_WEBHOOK_SECRET=whsec_...
```

> **Never** commit `.env.local`. The service role key has full DB access.

---

## 3. Local development

```bash
npm install
npm run dev
# → http://localhost:3000
```

---

## 4. Deploy to Vercel (one command)

```bash
npx vercel --prod
```

Or via the dashboard:
1. Push this repo to GitHub.
2. Import the repo at vercel.com → New Project.
3. Add the four env vars above under **Settings → Environment Variables**.
4. Deploy.

---

## 5. Edge Function (daily verification emails)

### Prerequisites
- Supabase CLI: `npm i -g supabase`
- Resend account (free tier works): https://resend.com — get your API key.

### Deploy

```bash
# Link to your Supabase project
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>

# Set secrets
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ...
supabase secrets set SITE_URL=https://your-app.vercel.app
supabase secrets set RESEND_API_KEY=re_xxxx

# Deploy the function
supabase functions deploy send-verification-emails --no-verify-jwt
```

### Schedule with pg_cron (Supabase Pro required)

In SQL Editor, uncomment and run the `cron.schedule` block at the bottom of
`supabase/schema.sql`, replacing `<YOUR_PROJECT_REF>` and `<YOUR_ANON_KEY>`.

Alternatively, use any external cron service (GitHub Actions, Railway, etc.) to
`POST https://<ref>.supabase.co/functions/v1/send-verification-emails` once a day.

### GitHub Actions cron alternative (free)

```yaml
# .github/workflows/verification-emails.yml
name: Send verification emails
on:
  schedule:
    - cron: '0 9 * * *'   # 09:00 UTC daily
  workflow_dispatch:

jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Edge Function
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            https://${{ secrets.SUPABASE_PROJECT_REF }}.supabase.co/functions/v1/send-verification-emails
```

Add `SUPABASE_ANON_KEY` and `SUPABASE_PROJECT_REF` to your GitHub repo secrets.

---

## 6. Email provider swap

The Edge Function uses **Resend** by default. To swap:
- Replace the `fetch('https://api.resend.com/emails', ...)` block in
  `supabase/functions/send-verification-emails/index.ts` with your provider's SDK call.
- Popular alternatives: SendGrid, Postmark, AWS SES.

---

## Architecture summary

```
/src/app
  /login              Sign in / sign up (role-aware, .edu enforcement)
  /onboarding         Profile creation (student or company)
  /projects           Public project feed with filters
  /projects/[id]      Project detail + apply modal
  /student/dashboard  Experience records + applications
  /company/dashboard  Post projects + manage applications
  /verify/[token]     Public token-based verification page (no auth)
  /api/verify         Server-side POST to update verification_status
  /api/resume         Signed URL generator for private resume files

/supabase
  schema.sql          All tables, RLS policies, storage bucket, cron comment
  /functions/send-verification-emails/index.ts   Deno Edge Function
```

## Security notes

- All DB access from the browser uses the **anon key** + RLS — no data leaks.
- Service role key is used **only** in server-side API routes (`/api/verify`, `/api/resume`)
  and the Edge Function — never in client components.
- Resume storage is private; signed URLs expire in 5 minutes.
- The verify page uses a UUID token (128-bit random, generated by Postgres) — not guessable.
- `.edu` enforcement happens both in the sign-up UI and in the onboarding form.
- Path traversal is sanitised in `/api/resume/route.ts`.
