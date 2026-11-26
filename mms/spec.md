# AKIJ Resource — Marketing Management System (MMS)
## MVP Specification & Data Model (v0.2 — mutually exclusive with the Brand OS)

> The MMS is the **marketing execution & governance** layer. It is **not** a commercial operating system.
> The existing **Brand OS** owns products, price, stock, cost, production, budget *sizing* and SKU mix.
> The MMS owns **campaigns, brand assets, brand perception measurement, competitive intelligence and marketing governance**.
> **No feature appears in both.**

---

## 0. Boundary with the Brand OS (hard, mutually exclusive)

The Brand OS (AEL Brand Operating System) runs the **commercial operating loop**: price → stock → COGS → P&L → production → campaign-budget sizing → SKU mix. The MMS must not duplicate any of it.

| Domain | Brand OS **owns** (MMS must NOT build) | MMS **owns** (Brand OS must NOT build) |
|---|---|---|
| Pricing / price declaration (TP/DP/MRP, bulk ASP) | ✔ | — |
| Stock & replenishment (stock cover, reorder, safety) | ✔ | — |
| COGS, P&L, NP, margin | ✔ | — |
| Production, yield, silo | ✔ | — |
| **Campaign budget sizing / envelope** | ✔ | — |
| Seasonality & SKU mix | ✔ | — |
| Campaign **execution** (brief→compliance→approval→PO→run→review) | — | ✔ |
| Brand assets & **brand-guideline compliance** | — | ✔ |
| Brand **equity / health measurement** (BEI/BHI, awareness, NPS, sentiment) | — | ✔ |
| Market share, **competitor, SOV, share-of-search** tracking | — | ✔ |
| **Marketing decision queue** (L0–L4) & actions | — | ✔ |
| Marketing reporting / board packs | — | ✔ |
| RBAC + audit of marketing workflow | — | ✔ |

**Non-overlap rule (enforced in the product):**
- MMS **never** sets or edits price, cost, stock, production, budget envelope, or SKU mix.
- Brand OS **never** runs campaigns, approvals, brand-KPI surveys, or competitive tracking.
- Where MMS needs a commercial number (revenue, margin, budget), it **reads it from Brand OS/ERP as read-only** — it does not recompute or re-size it.

### Interface contracts
- **Brand OS → MMS (read-only):** monthly marketing budget envelope by SBU/channel; approved price/margin; SKU & seasonality constraints; sell plan.
- **MMS → Brand OS (feedback):** campaign commitments/actuals (PO/GRN), campaign effectiveness/ROMI, brand-KPI outcomes, competitive alerts.

---

## 1. MVP scope

**In scope**
1. **Campaign lifecycle & execution** — brief → brand compliance → budget-availability check (against the Brand-OS envelope) → DoA approval → PO link → execution → post-campaign review.
2. **Brand assets & guideline compliance** — style-guide repo, DAM, compliance score, version control.
3. **Measurement** — brand tracker waves, BEI/BHI brand KPIs (awareness, TOMA, perceived quality, preference, loyalty, consideration, NPS, CSAT, sentiment, advocacy), score recompute, RAG alerts.
4. **Competitive & market intelligence** — competitor shares, SOV, share-of-search, social/news listening; SOV<SOM flag.
5. **Decision queue & actions** — CBDO L0–L4 for marketing; owner, deadline, escalation, action log.
6. **RBAC + audit** — per SBU/custodian; immutable approval trail.
7. **Reporting** — marketing board pack (PDF/PPT), MD brief, exports.
8. **Integrations** — campaign spend/commitments (ERP PO/GRN), tracker, CRM, social/search.

**Explicitly OUT (owned by Brand OS):** pricing, stock/replenishment, COGS/P&L/NP, production/yield/silo, **budget sizing**, SKU mix/seasonality.

---

## 2. What we reuse (rules engine, not features)

7-dimension framework + weights; BEI/BHI/BPI; 61-metric dictionary; SBU scorecards; revenue↔share reconciliation; YoY/QoQ ramp; 4P / Brand Guide / ICP; activity→KPI matrix; competitor share capture; CBDO escalation; Data Gap Register. These are the **scoring & rules layer**; the MMS adds workflow, write-back and audit.

---

## 3. Architecture

```
Brand OS (budget envelope, price/margin, SKU/seasonality) ──read-only──┐
ERP/DWH (campaign PO/GRN, GL 4210001 actuals) ──────────────┐         │
Brand tracker (survey waves)                              ├─► ETL ─► Postgres (campaigns, approvals,
CRM (NPS/CSAT/retention)                                  │  (T+1)    assets, tracker, decisions, audit)
Social/search/competitor feeds ───────────────────────────┘                │
                                                                           ▼
     Static read layer (JSON) ◄── API (REST) ◄── Next.js/React app (SSO)
                                    Cloudflare/Vercel + Cron
```

Read layer = dashboard snapshots (CDN). Write layer = Postgres for the workflow. Jobs = ETL, sync-health, score recompute, alerts.

---

## 4. Modules (MVP) & acceptance

| # | Module | Features | Acceptance |
|---|---|---|---|
| 1 | **Campaign lifecycle** | Brief → brand-guide check → budget-availability (from envelope) → DoA approval → PO link → execution → post-campaign review | Cannot pass without compliance + availability + approver; review records brand-KPI delta |
| 2 | **Brand assets & compliance** | Style-guide repo, DAM, compliance score, version | Asset stores guide version + score; low score blocks |
| 3 | **Measurement** | Tracker-wave scheduling; BEI/BHI KPI actuals; score recompute; RAG alerts | Scores update per wave; Red auto-opens a decision |
| 4 | **Competitive intel** | Competitor shares, SOV, share-of-search, social/news; SOV<SOM flag | Share table + SOV/SOM alert refresh quarterly/monthly |
| 5 | **Decision & actions** | L0–L4 queue, owner, deadline, escalation, action log | Every Red KPI has owner + deadline; weekly review generated |
| 6 | **RBAC & audit** | Roles, SBU scoping, audit log | Users see only their SBUs; every change logged |
| 7 | **Reporting** | Marketing board pack, MD brief, CSV/Excel | One-click pack; no commercial-ops data duplicated from Brand OS |

> Budget is **not** an MMS module. Campaigns reference an **approved envelope** supplied by the Brand OS.

---

## 5. Roles

Admin · CBDO · SBU Head · Brand Custodian · Finance (verify commitments vs GL) · Viewer/MD. RBAC scoped by SBU.

---

## 6. Data model (core tables)

> All tables carry `id, created_at, updated_at, created_by`. SBU-bound tables carry `sbu_id`. Money in BDT. **No price, COGS, stock, production or SKU-mix tables — those live in Brand OS.**

**Org & access**
- `sbu(id, code, name, archetype, cluster, custodian_id, business_head_id)`
- `user(id, name, email, role_id, active)`, `role(id, name, permissions)`, `user_sbu(user_id, sbu_id)`
- `audit_log(id, user_id, entity, entity_id, action, before_json, after_json, ts)`

**KPI framework (brand/marketing only)**
- `kpi(id, sbu_id, dimension_code, name, definition, formula, unit, direction, method, frequency, owner_id, core_monitor, conf, status)` — D1/D2/D3/D6 brand & marketing metrics; financial D5 fields are **read-only refs** to ERP/Brand OS
- `kpi_target(id, kpi_id, fy, quarter NULL, target, baseline, source, approved_by, approved_at)`
- `kpi_actual(id, kpi_id, period_fy, period_q, value, source, ingested_at, dq_flag)`
- `score_snapshot(id, sbu_id, period, bei, bhi, bpi, composite, computed_at)`

**Campaign & execution**
- `budget_envelope_ref(id, sbu_id, fy, quarter, channel, envelope_amount, source='BrandOS', synced_at)` — **read-only mirror**, never edited in MMS
- `campaign(id, sbu_id, fy, name, objective, kpi_ids_json, channel_mix_json, start_date, end_date, planned_spend, envelope_ref_id, owner_id, status, brief_url)`
- `campaign_asset(id, campaign_id, asset_type, file_url, guide_version, compliance_score, approved)`
- `approval(id, entity_type, entity_id, step, approver_id, decision, comment, decided_at)`
- `commitment(id, campaign_id, po_no, amount, grn_status, gl_date, erp_ref)` — read from ERP
- `campaign_review(id, campaign_id, kpi_deltas_json, result, learning, closed_at)`

**Measurement & market**
- `tracker_wave(id, sbu_id, wave_no, vendor, field_start, field_end, status, report_url)`
- `competitor(id, sbu_id, name, share_value, share_unit, period, source)`
- `sov_som(id, sbu_id, period, sov, som, flag)`
- `data_gap(id, sbu_id, kpi_id, description, proxy, method, owner_id, due_date, status)`

**Governance**
- `decision(id, sbu_id, kpi_id, issue, impact, level, owner_id, deadline, status)`
- `action(id, decision_id, owner_id, description, deadline, status, closed_at)`
- `integration_sync(id, source, last_run, status, rows_loaded, lag_minutes)`

**Relationships:** `sbu 1─* campaign 1─* campaign_asset / approval / commitment / campaign_review`; `campaign *─1 budget_envelope_ref`; `sbu 1─* decision 1─* action`.

---

## 7. Core workflows

**A. Campaign lifecycle (starts from a Brand-OS envelope)**
Brief → brand-guide compliance (blocks if score < threshold) → budget availability check against `budget_envelope_ref` → DoA approval → PO (ERP) → execution → GRN → post-campaign review (brand-KPI delta) → close.

**B. Measurement**
Schedule tracker wave → vendor → ingest → KPI actuals → recompute BEI/BHI/BPI → RAG alert → Red auto-opens decision.

**C. Decision queue**
KPI breach / SOV<SOM / campaign underperformance → decision with level → owner + deadline → action → close or escalate (L0–L4).

---

## 8. API outline

```
GET  /api/sbus                     GET  /api/sbus/:id/scores
GET  /api/kpis?sbu=                POST /api/kpis/:id/actuals
GET  /api/campaigns?sbu=           POST /api/campaigns
POST /api/campaigns/:id/submit     POST /api/approvals/:id/decide
GET  /api/budget-envelopes?sbu=    (read-only from Brand OS)
GET  /api/commitments?campaign=    POST /api/campaigns/:id/review
GET  /api/decisions?sbu=&level=    POST /api/decisions
POST /api/actions/:id/close        GET /api/tracker-waves?sbu=
GET  /api/competitors?sbu=         GET /api/data-gaps?sbu=
GET  /api/sync-health              GET /api/reports/board-pack?sbu=&fy=
```

---

## 9. Data contracts & ETL

- **From Brand OS (read-only):** budget envelope by SBU/channel/quarter; approved price/margin (only if a campaign needs a price reference); SKU/seasonality constraints.
- **From ERP:** campaign PO/GRN, GL 4210001 actuals (daily).
- **From tracker:** survey wave file/API (quarterly).
- **From CRM:** NPS/CSAT/retention (monthly).
- **From market:** competitor shares, SOV, search (quarterly/monthly).
- Every ingest writes `integration_sync` + DQ flags; a stalled feed blocks "green" status.

---

## 10. Security & audit

SSO (Google Workspace), role + SBU scoping, field masking for finance, immutable audit log for approvals/asset sign-off/campaign changes, mandatory source labels.

---

## 11. Phase plan

| Phase | Duration | Deliverable (all marketing-only) |
|---|---|---|
| **1 — Spine** | 6–8 wks | Campaign lifecycle + brand-compliance gate + approvals + RBAC + decision queue + marketing board pack |
| **2 — Measure** | 4–6 wks | Tracker/CRM ingest, BEI/BHI recompute, competitive intel, data-gap workflow |
| **3 — Advanced** | 6–8 wks | Campaign effectiveness analytics, AI insights, experimentation |

**First prototype (recommended): Campaign lifecycle** (not Planning & Budget — budget sizing lives in the Brand OS).

---

## 12. Recommended first prototype — Campaign lifecycle (screens)

1. **SBU + FY selector** (ACCL default).
2. **Campaign list** (status: draft → compliance → approval → live → review).
3. **Campaign brief & KPI targets** (pick from the brand KPI set).
4. **Brand-guideline compliance check** (asset vs style guide; score).
5. **Budget availability** (reads Brand-OS envelope; shows remaining — read-only).
6. **Approval timeline** (custodian → SBU Head → CBDO by DoA).
7. **PO / GRN link** (ERP commitment).
8. **Post-campaign review** (brand-KPI delta, learning, close).
9. **Export** to board pack.

---

## 13. Open decisions

1. Confirm the boundary: MMS excludes price, stock, COGS/P&L/NP, production, budget sizing, SKU mix — yes?
2. First module to prototype: **Campaign lifecycle** (recommended)?
3. Input mechanism from Brand OS: API, DB view, or scheduled export?
4. Auth: Google Workspace SSO?
5. DB: Postgres (Supabase/Neon)?
6. Approval thresholds (BDT Cr) for SBU Head vs CBDO.
7. Deploy: Cloudflare Pages + Workers/Neon, or Vercel?

---

*Sources: AKIJ Brand KPI Dashboard; Brand OS (AEL) skill; Brand Marketing Packs; Brand Maturity Audit; Corporate Strategy; ERP/DWH schema; AR Marketing Budget 26-27.*
