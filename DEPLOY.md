# Innago PO Outreach — Deployment Guide

## Overview
- **Frontend + API**: Next.js 14 → Vercel
- **Database**: Supabase (Postgres)
- **AI**: Anthropic Claude (email copy + briefs)
- **Leads**: Apollo.io (prospect discovery + enrichment)
- **Email**: Brevo (sending + tracking)
- **Calendar**: Microsoft 365 (meeting booking)
- **SEO Research**: Ahrefs (top-ranking PM sites by city)

---

## Step 1 — Supabase Setup

1. Go to [supabase.com](https://supabase.com) → New Project
2. Name it `innago-po-outreach`, choose your region
3. In **SQL Editor**, paste the contents of `supabase/schema.sql` and run it
4. Go to **Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 2 — API Keys

### Apollo.io
1. Log in → [developer.apollo.io](https://developer.apollo.io/)
2. Create an API key → copy as `APOLLO_API_KEY`

### Brevo
1. Go to [app.brevo.com/settings/keys/api](https://app.brevo.com/settings/keys/api)
2. Create a key → copy as `BREVO_API_KEY`
3. Set sender: `BREVO_SENDER_EMAIL=outreach@innago.com`, `BREVO_SENDER_NAME=Innago Sales`

### Anthropic (Claude)
1. Go to [console.anthropic.com/keys](https://console.anthropic.com/keys)
2. Create key → copy as `ANTHROPIC_API_KEY`

### Ahrefs
1. Go to [app.ahrefs.com/account/api](https://app.ahrefs.com/account/api)
2. Create key → copy as `AHREFS_API_KEY`

### Microsoft 365 (Azure App Registration)
1. Go to [portal.azure.com](https://portal.azure.com) → Azure Active Directory → App registrations → New registration
2. Name: `Innago PO Outreach`
3. Redirect URI: `https://YOUR-VERCEL-URL.vercel.app/api/auth/ms365/callback`
4. Under **Certificates & secrets** → New client secret → copy as `MS365_CLIENT_SECRET`
5. Copy Application (client) ID → `MS365_CLIENT_ID`
6. Copy Directory (tenant) ID → `MS365_TENANT_ID`
7. Under **API permissions** → Add: `Calendars.ReadWrite`, `User.Read`, `offline_access`

---

## Step 3 — Deploy to Vercel

```bash
# 1. Push to GitHub
git init
git add .
git commit -m "Initial Innago PO Outreach app"
git remote add origin https://github.com/your-org/innago-po-outreach
git push -u origin main

# 2. Import on Vercel
# Go to vercel.com → New Project → Import your repo
```

3. In Vercel project settings → **Environment Variables**, add ALL keys from `.env.example`:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | From Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | From Supabase |
| `ANTHROPIC_API_KEY` | From Anthropic Console |
| `APOLLO_API_KEY` | From Apollo |
| `BREVO_API_KEY` | From Brevo |
| `BREVO_SENDER_EMAIL` | `outreach@innago.com` |
| `BREVO_SENDER_NAME` | `Innago Sales` |
| `MS365_CLIENT_ID` | From Azure |
| `MS365_CLIENT_SECRET` | From Azure |
| `MS365_TENANT_ID` | From Azure |
| `MS365_REDIRECT_URI` | `https://your-app.vercel.app/api/auth/ms365/callback` |
| `AHREFS_API_KEY` | From Ahrefs |
| `NEXT_PUBLIC_APP_URL` | Your Vercel URL |

4. Deploy → Vercel builds automatically

---

## Step 4 — Connect Sales Reps to MS365

Each sales rep must connect their Microsoft 365 calendar once:

1. Go to the app → **Settings**
2. Add the rep (name + email)
3. Click **Connect MS365** next to their name
4. Log in with their Microsoft account
5. Token is stored in Supabase — refreshes automatically

---

## Step 5 — First Campaign

1. Click **New Campaign** on the dashboard
2. Enter city (e.g. `Columbus`), state (`OH`), switch incentive (optional)
3. You'll land on the **Discover** tab — click **Search** to pull prospects from Apollo + Ahrefs
4. Review the list, then go to **Outreach** to generate + send emails
5. Log replies in **Convert** → classify → book meetings
6. Meeting briefs auto-generate and appear in **Meetings**

---

## Architecture Notes

```
Browser
  └── Next.js App (Vercel)
        ├── /api/discover    → Apollo.io + Ahrefs API
        ├── /api/enrich      → Apollo.io enrichment
        ├── /api/email/*     → Anthropic (generate) + Brevo (send)
        ├── /api/replies/*   → Anthropic classification
        ├── /api/meetings/*  → MS365 Graph API + Anthropic briefs
        └── /api/sequences   → Brevo + Anthropic
              │
              └── Supabase (Postgres)
                    campaigns, prospects, outreach_emails,
                    replies, meetings, sequences, sales_reps
```

---

## Local Development

```bash
cd po-outreach-app
npm install
cp .env.example .env.local
# Fill in .env.local with your keys
npm run dev
# → http://localhost:3000
```
