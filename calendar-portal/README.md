# AKIJ Growth Activity Calendar — Live Portal

A lightweight, link-shareable web portal for the **Marketing, Business Development & Growth
Activity Calendar (FY 2026-27)**. Team members open a link, submit / update campaign or activity
plans, and everyone sees a live analytics dashboard and monthly calendar.

**Stack:** static site + Netlify Functions + Netlify Blobs (no external database, no login).
Deployed to **Netlify** and auto-built via GitHub Actions using the org's existing Netlify secrets.

## Features

- **Add Activity** — anyone with the link can submit a plan (Date, SBU, Activity, Category,
  Goal, Budget Cr, KPI, Responsible, Status, Progress %, Actual Spend, Notes, Name). Duplicate
  (date + SBU + activity) entries update the existing row instead of duplicating.
- **Analytics Dashboard** — live stat cards, activities & budget by category / SBU, status
  distribution, monthly pipeline, and a filterable tracker with inline status editing + delete.
- **Calendar** — monthly view (Jul-26 → Jun-27) with SBU / category filters.
- **56 baseline activities** auto-seeded on first load (from `netlify/functions/seed.json`).

## Architecture

```
public/index.html            → static single-page app (Dashboard / Add / Calendar)
netlify/functions/plans.js   → GET/POST/PATCH/DELETE  /api/plans  (Netlify Blobs store)
netlify/functions/analytics.js → GET  /api/analytics    (aggregates computed in-function)
netlify/functions/seed.json  → 56 baseline FY26-27 activities
netlify.toml                → build config + /api/* redirects
```

Data is persisted in a single **Netlify Blob** (`plans-data`), seeded automatically when empty.
No external database or credentials are required.

## Local development

```bash
cd calendar-portal
npm install
npx netlify dev          # http://localhost:8888  (proxies /api/* to the functions)
```

## Deploy (already wired)

A GitHub Actions workflow (`.github/workflows/deploy-calendar-portal.yml`) deploys on every push
to `calendar-portal/**` using the repo's existing `NETLIFY_TOKEN` secret. It finds or creates a
site named `akij-growth-calendar` and deploys `public/` + `netlify/functions/` to production.

The site is created on first run → the live URL is `https://akij-growth-calendar.netlify.app`.

## Notes & caveats

- **Open by design** — the link is public; there is no login. To restrict writes, add a shared
  access-code check inside `netlify/functions/plans.js` (POST/PATCH/DELETE) and pass it from the form.
- **Concurrency** — the store does read-modify-write on a single JSON blob; fine for a team
  calendar (low write volume). For very high write concurrency, migrate to a real database.
- Budget figures for several SBUs in the source DWH (`bgt` schema, GL 4210001) were
  negative / zero / inflated — the baseline seed uses indicative allocations. Confirm approved
  budgets before spend commitment.
