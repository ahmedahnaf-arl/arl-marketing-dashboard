# AKIJ Growth Activity Calendar — Live Portal

A lightweight, link-shareable web portal for the **Marketing, Business Development & Growth
Activity Calendar (FY 2026-27)**. Team members open a link, submit / update campaign or activity
plans, and everyone sees a live analytics dashboard and monthly calendar.

Built with **Next.js (App Router) + PostgreSQL** — deployable to **Vercel** in minutes.

## Features

- **Add Activity** — anyone with the link can submit a plan (Date, SBU, Activity, Category,
  Goal, Budget, KPI, Responsible, Status, Progress, Actual Spend, Notes). Duplicate
  (date + SBU + activity) entries update the existing row instead of duplicating.
- **Analytics Dashboard** — live stat cards, activities & budget by category / SBU, status
  distribution, monthly pipeline, and a filterable tracker with inline status editing.
- **Calendar** — monthly view (Jul-26 → Jun-27) with SBU / category filters.
- **56 baseline activities** pre-loaded via a seed script.

## Quick start (local)

```bash
cd calendar-portal
npm install
copy .env.example .env      # then fill in DATABASE_URL
npm run dev                  # http://localhost:3000
```

The table and the 56 baseline FY26-27 activities are created automatically on the
first request (lazy bootstrap) — no manual migration/seed step is required. The
`npm run db:schema` and `npm run db:seed` scripts are provided only if you want to run them manually.

## Deploy to Vercel + hosted Postgres (≈ 3 minutes)

1. **Create a free Postgres database** — [Neon](https://neon.tech) (recommended) or
   [Supabase](https://supabase.com):
   - Neon: Create project → copy the connection string from the **Connect** panel
     (it ends with `?sslmode=require`).
   - Supabase: Project → Settings → Database → copy the **Session pooler** connection string.
2. **Push this folder** to a GitHub repo (already committed under `calendar-portal/`).
3. **Import to Vercel**: vercel.com → Add New → Project → select the repo →
   set **Root Directory = `calendar-portal`** → Vercel auto-detects Next.js.
4. **Add one environment variable** in Vercel → Settings → Environment Variables:
   - `DATABASE_URL` = the Postgres connection string (with `?sslmode=require`).
5. **Deploy** — share the URL. The table + 56 baseline activities are created on first load.

No build step, no migration, no seed step needed beyond pasting `DATABASE_URL`.

## Database

Single table `plans`:

| column | type | notes |
| --- | --- | --- |
| id | text | UUID |
| activity_date | date | scheduled date |
| sbu | text | SBU code (ACCL, AIL, …) |
| activity | text | description |
| category | text | one of 10 growth categories |
| goal | text | business / marketing goal |
| budget_cr | numeric | approved budget in Crore |
| kpi | text | expected outcome / KPI |
| responsible | text | owner |
| status | text | Planned / In Progress / Completed / On Hold / Cancelled |
| progress | int | 0–100 |
| actual_spend | numeric | BDT |
| notes | text | tracker notes |
| created_by | text | optional submitter name |

## Notes & caveats

- **Open by design** — the link is public; there is no login. If you need to restrict writes,
  add an access key check in `app/api/plans/route.js` (POST) and pass it from the entry form.
- Budget figures for several SBUs in the source DWH (`bgt` schema, GL 4210001) were
  negative / zero / inflated — the baseline seed uses indicative allocations and flags are not
  carried here. Confirm approved budgets before spend commitment.
