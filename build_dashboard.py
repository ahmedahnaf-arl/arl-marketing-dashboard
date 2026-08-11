import json
import os

DATA_PATH = r"C:\Users\Hp\AppData\Local\Temp\opencode\pdca_final.json"
OUT_PATH = r"C:\Users\Hp\Downloads\Marketing_Campaign_Portal_FY26-27.html"

with open(DATA_PATH) as f:
    d = json.load(f)

sb = d['sbu_data']
atl_pos_list = d['atl_pos']
btl_pos_list = d['btl_pos']
j_atl_list = d['j_atl']
nba_list = d['nba']
tt = d['tt']

# ---------- build lookup maps ----------
bu_to_name = {s['bu_id']: s['name'] for s in sb}
j_to_name   = {s['j_id']: s['name'] for s in sb}
name_to_bu  = {s['name']: s['bu_id'] for s in sb}
name_to_slug = {}  # filled below

def resolve_sbu_name(bu_id):
    return bu_to_name.get(bu_id, f"SBU #{bu_id}")

# ---------- compute totals ----------
atl_total = sum(s['act_atl'] for s in sb)
btl_total = sum(s['act_btl'] for s in sb)
campaign_total = atl_total + btl_total
total_pos = sum(s['pos'] for s in sb)
total_rev = sum(s['rev'] for s in sb)

# ---------- ATL journal by SBU ----------
atl_j = {}
atl_j_mapped_total = 0.0
for j in j_atl_list:
    nm = j_to_name.get(j['sbu'], None)
    if nm is None:
        continue
    atl_j.setdefault(nm, 0.0)
    atl_j[nm] += j['amt']
    atl_j_mapped_total += j['amt']

# ---------- ATL PO by SBU ----------
atl_po_by_sbu = {}
atl_po_val_total = sum(p.get('atl', p.get('val', 0)) for p in atl_pos_list)
for p in atl_pos_list:
    nm = resolve_sbu_name(p['bu'])
    atl_po_by_sbu.setdefault(nm, {'count': 0, 'val': 0.0})
    atl_po_by_sbu[nm]['count'] += 1
    atl_po_by_sbu[nm]['val'] += p.get('atl', p.get('val', 0))

# ---------- BTL PO by SBU ----------
btl_po_by_sbu = {}
for p in btl_pos_list:
    nm = resolve_sbu_name(p['bu'])
    btl_po_by_sbu.setdefault(nm, {'count': 0, 'val': 0.0})
    btl_po_by_sbu[nm]['count'] += 1
    btl_po_by_sbu[nm]['val'] += p.get('btl', 0)

# ---------- BTL categories (hardcoded from requirements) ----------
btl_categories = [
    ("Dealer Merchandise", 0.57),
    ("Farmer Training Kits", 0.13),
    ("Consumer Sampling", 0.10),
    ("Electrician/Mechanic Kits", 0.09),
    ("POSM & Signage", 0.04),
    ("Event & Dealer Meet", 0.03),
    ("Dealer Incentive Gifts", 0.01),
]

# ---------- 13-month revenue trend (hardcoded) ----------
monthly_rev = [
    ("Jul '25", 960.33),
    ("Aug '25", 1017.68),
    ("Sep '25", 837.92),
    ("Oct '25", 1042.61),
    ("Nov '25", 1082.27),
    ("Dec '25", 1130.48),
    ("Jan '26", 1174.89),
    ("Feb '26", 1102.16),
    ("Mar '26", 948.57),
    ("Apr '26", 951.04),
    ("May '26", 640.54),
    ("Jun '26", 656.03),
    ("Jul '26", 722.28),
    ("Aug '26", 207.89),
]

# ---------- top 10 budget vs actual for bar chart ----------
sb_sorted = sorted(sb, key=lambda x: x['total_fy'], reverse=True)[:10]
bar_labels = [s['name'] for s in sb_sorted]
bar_budget = [s['total_fy'] for s in sb_sorted]
bar_actual = [s['act_total'] for s in sb_sorted]

# ---------- SBU scorecard (all SBUs) ----------
scorecard = sorted(sb, key=lambda x: x['total_fy'], reverse=True)

# ---------- Efficiency KPIs ----------
cac = 46893  # BDT
cac_ltv = "1:55"
avg_rev_cust = 25.94  # Lakhs
mom_growth = "+10.1%"
estimated_total_customers = total_rev / 0.2594 if total_rev > 0 else 1

# ---------- helper ----------
def esc(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")

def fmt_cr(v):
    return f"{v:,.2f}"

def fmt_bdt(v):
    return f"{v:,.0f}"

def sbu_safe(name):
    return name.replace(" ", "_").replace("(", "").replace(")", "").replace(".", "").replace("&", "")

# Fill name_to_slug
for s in sb:
    name_to_slug[s['name']] = sbu_safe(s['name'])

# ----------  Build per-SBU map for JS ----------
sbu_js_map = {}
for s in sb:
    slug = sbu_safe(s['name'])
    nm = s['name']
    ainfo = atl_po_by_sbu.get(nm, {'count': 0, 'val': 0.0})
    binfo = btl_po_by_sbu.get(nm, {'count': 0, 'val': 0.0})
    est_cust = s['rev'] / 0.2594 if s['rev'] > 0 else 0
    atl_per_cust = (s['act_atl'] * 10000000) / est_cust if est_cust > 0 else 0
    btl_per_cust = (s['act_btl'] * 10000000) / est_cust if est_cust > 0 else 0
    sbu_js_map[slug] = {
        'atl_fy': s['atl_fy'], 'btl_fy': s['btl_fy'], 'total_fy': s['total_fy'],
        'q1_atl': s['q1_atl'], 'q1_btl': s['q1_btl'], 'q1_total': s['q1_total'],
        'expected_burn': s['expected_burn'], 'act_atl': s['act_atl'], 'act_btl': s['act_btl'],
        'act_total': s['act_total'], 'burn_pct': s['burn_pct'], 'rev': s['rev'],
        'romi': s['romi'], 'pos': s['pos'], 'grn': s.get('grn', 0),
        'po_committed': s.get('po_committed', 0),
        'atl_po_count': ainfo['count'], 'atl_po_val': ainfo['val'],
        'btl_po_count': binfo['count'], 'btl_po_val': binfo['val'],
        'atl_per_cust': atl_per_cust, 'btl_per_cust': btl_per_cust,
    }

# ---------- ATL Channel Split data ----------
atl_po_total = sum(p.get('atl', p.get('val', 0)) for p in atl_pos_list)
atl_unmapped = max(0, atl_total - atl_j_mapped_total)
atl_channel_data = [atl_j_mapped_total, atl_po_total, atl_unmapped]
atl_channel_labels = ["ATL Journal (Mapped)", "ATL Service POs", "Unmapped Journal"]

# ---------- ATL Spend by SBU (all SBUs with act_atl > 0) ----------
atl_sbu_data = sorted([(s['name'], s['act_atl']) for s in sb if s['act_atl'] > 0], key=lambda x: x[1], reverse=True)

# ---------- BTL GRN Progress (top 10 POs by GRN%) ----------
btl_grn_data = sorted(btl_pos_list, key=lambda x: x.get('recv_pct', 0), reverse=True)[:10]
btl_grn_labels = [p['po'] for p in btl_grn_data]
btl_grn_values = [p.get('recv_pct', 0) / 100 for p in btl_grn_data]  # fraction 0-1

# ---------- BTL Vendor Spend ----------
vendor_spend = {}
for p in btl_pos_list:
    v = p['vendor'].strip()
    vendor_spend.setdefault(v, 0.0)
    vendor_spend[v] += p.get('btl', 0)
top_vendors = sorted(vendor_spend.items(), key=lambda x: x[1], reverse=True)[:10]

# ---------- build HTML ----------
html = []
html.append('''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Marketing Campaign Portal FY 2026-27</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
:root {
  --bg: #060b14;
  --card-bg: #0a1120;
  --border: #1a2540;
  --accent: #00d4aa;
  --accent2: #6c8cff;
  --text: #c8d0e0;
  --muted: #6b7a99;
  --critical: #ff4757;
  --warning: #ffa502;
  --positive: #2ed573;
  --tab-active: #0d1a30;
}
* { margin:0; padding:0; box-sizing:border-box; }
body { background:var(--bg); color:var(--text); font-family:'Segoe UI',system-ui,sans-serif; line-height:1.5; }
.header { background:linear-gradient(135deg,#0a1120,#0d1530); border-bottom:1px solid var(--border); padding:16px 24px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; }
.header h1 { font-size:1.3rem; font-weight:600; color:#e8ecf4; }
.header .filter-group { display:flex; gap:10px; align-items:center; }
.header select { background:var(--card-bg); color:var(--text); border:1px solid var(--border); padding:6px 12px; border-radius:6px; font-size:0.85rem; outline:none; cursor:pointer; }
.header select:focus { border-color:var(--accent); }
.tabs { display:flex; gap:2px; padding:0 24px; background:#080c1a; border-bottom:1px solid var(--border); overflow-x:auto; }
.tab-btn { background:transparent; color:var(--muted); border:none; padding:10px 18px; font-size:0.85rem; font-weight:500; cursor:pointer; border-bottom:2px solid transparent; white-space:nowrap; transition:all .2s; }
.tab-btn:hover { color:var(--text); }
.tab-btn.active { color:var(--accent); border-bottom-color:var(--accent); }
.tab-content { display:none; padding:20px 24px; }
.tab-content.active { display:block; }
.card { background:var(--card-bg); border:1px solid var(--border); border-radius:10px; padding:16px; }
.kpi-row { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:20px; }
.kpi-card { background:var(--card-bg); border:1px solid var(--border); border-radius:10px; padding:14px 16px; }
.kpi-card .label { font-size:0.72rem; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; }
.kpi-card .value { font-size:1.25rem; font-weight:700; color:#e8ecf4; }
.kpi-card .value.accent { color:var(--accent); }
.kpi-card .sub { font-size:0.7rem; color:var(--muted); margin-top:2px; }
.chart-wrap { background:var(--card-bg); border:1px solid var(--border); border-radius:10px; padding:16px; margin-bottom:20px; }
.chart-wrap h3 { font-size:0.85rem; color:var(--muted); margin-bottom:12px; text-transform:uppercase; letter-spacing:1px; }
.chart-wrap canvas { max-height:320px; }
table { width:100%; border-collapse:collapse; font-size:0.82rem; }
table th { background:#0d1530; color:var(--muted); font-weight:500; text-align:left; padding:8px 12px; border-bottom:1px solid var(--border); font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; }
table td { padding:8px 12px; border-bottom:1px solid rgba(26,37,64,0.5); }
table tr:hover td { background:rgba(0,212,170,0.03); }
table .text-right { text-align:right; }
.badge { display:inline-block; padding:2px 8px; border-radius:4px; font-size:0.7rem; font-weight:600; }
.badge.critical { background:rgba(255,71,87,0.18); color:var(--critical); }
.badge.warning { background:rgba(255,165,2,0.18); color:var(--warning); }
.badge.positive { background:rgba(46,213,115,0.18); color:var(--positive); }
.badge.neutral { background:rgba(108,140,255,0.15); color:var(--accent2); }
.badge.atl { background:rgba(108,140,255,0.15); color:var(--accent2); }
.badge.btl { background:rgba(0,212,170,0.15); color:var(--accent); }
.section-title { font-size:0.78rem; color:var(--muted); text-transform:uppercase; letter-spacing:1px; margin:20px 0 10px; }
.grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.grid-3 { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
.grid-4 { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
.blocker-card { background:var(--card-bg); border:1px solid var(--border); border-radius:10px; padding:14px; }
.blocker-card .bl-lvl { font-size:0.68rem; text-transform:uppercase; font-weight:700; margin-bottom:4px; }
.blocker-card .bl-title { font-size:0.88rem; font-weight:600; color:#e8ecf4; margin-bottom:4px; }
.blocker-card .bl-desc { font-size:0.75rem; color:var(--muted); }
.nba-card { background:var(--card-bg); border:1px solid var(--border); border-left:3px solid var(--accent); border-radius:10px; padding:14px; }
.nba-card.critical { border-left-color:var(--critical); }
.nba-card.warning { border-left-color:var(--warning); }
.nba-card.positive { border-left-color:var(--positive); }
.nba-card .nba-title { font-size:0.85rem; font-weight:600; color:#e8ecf4; }
.nba-card .nba-msg { font-size:0.78rem; color:var(--muted); margin:4px 0; }
.nba-card .nba-act { font-size:0.75rem; color:var(--accent); }
.action-row { display:flex; align-items:center; gap:8px; padding:8px 0; border-bottom:1px solid var(--border); }
.action-row .action-num { width:24px; height:24px; border-radius:50%; background:var(--accent); color:var(--bg); display:flex; align-items:center; justify-content:center; font-size:0.72rem; font-weight:700; flex-shrink:0; }
.action-row .action-text { font-size:0.82rem; color:var(--text); }
.gap-section { margin-bottom:16px; }
.gap-section h4 { font-size:0.8rem; color:var(--accent); margin-bottom:8px; text-transform:uppercase; letter-spacing:1px; }
.po-table-wrap { max-height:400px; overflow-y:auto; }
.donut-wrap { display:flex; align-items:center; gap:24px; }
.donut-wrap canvas { max-width:220px; max-height:220px; }
.donut-legend { font-size:0.75rem; color:var(--text); }
.donut-legend li { margin-bottom:4px; list-style:none; }
.donut-legend li span.dot { display:inline-block; width:10px; height:10px; border-radius:2px; margin-right:6px; }
.eff-grid { display:grid; grid-template-columns:repeat(6,1fr); gap:12px; margin-bottom:20px; }
@media(max-width:1200px){ .eff-grid{grid-template-columns:repeat(4,1fr);} }
@media(max-width:768px){ .grid-2,.grid-3,.grid-4{grid-template-columns:1fr;} .eff-grid{grid-template-columns:repeat(2,1fr);} .kpi-row{grid-template-columns:repeat(2,1fr);} }
.filter-note { display:none; font-size:0.78rem; color:var(--accent); background:rgba(0,212,170,0.08); border:1px solid rgba(0,212,170,0.2); border-radius:6px; padding:8px 14px; margin-bottom:16px; }
</style>
</head>
<body>
<div class="header">
  <h1>Marketing Campaign Portal &mdash; FY 2026-27</h1>
  <div class="filter-group">
    <label style="color:var(--muted);font-size:0.78rem;">SBU Filter</label>
    <select id="sbuFilter" onchange="filterSBU()">
      <option value="all">All SBUs</option>
''')

for s in scorecard:
    html.append(f'      <option value="{sbu_safe(s["name"])}">{esc(s["name"])}</option>')

html.append('''    </select>
    <select id="monthFilter" onchange="filterSBU()" style="display:none;">
      <option value="all">All Months</option>
    </select>
  </div>
</div>
<div class="filter-note" id="filterNote"></div>
<div class="tabs">
  <button class="tab-btn active" onclick="openTab(event,'tab-all')">ALL</button>
  <button class="tab-btn" onclick="openTab(event,'tab-atl')">ATL Channels</button>
  <button class="tab-btn" onclick="openTab(event,'tab-btl')">BTL Channels</button>
  <button class="tab-btn" onclick="openTab(event,'tab-eff')">Efficiency</button>
  <button class="tab-btn" onclick="openTab(event,'tab-nba')">NBA</button>
  <button class="tab-btn" onclick="openTab(event,'tab-gap')">Gap Analysis</button>
</div>
''')

# ==========================================
# TAB 1 - ALL (Executive Summary)
# ==========================================
html.append('<div class="tab-content active" id="tab-all">')

kpi1 = [
    ("FY Budget", f"{111.06:,.2f} Cr", ""),
    ("Q1 Allocation", f"{21.57:,.2f} Cr", ""),
    ("Expected Burn", f"{9.61:,.2f} Cr", ""),
    ("ATL Spend", f"{atl_total:,.2f} Cr", ""),
    ("BTL Spend", f"{btl_total:,.2f} Cr", ""),
    ("Total Campaign", f"{campaign_total:,.2f} Cr", ""),
    ("Revenue", f"{total_rev:,.2f} Cr", ""),
    ("Active POs", str(total_pos), ""),
]
html.append('<div class="kpi-row" id="kpi-exec">')
for label, val, sub in kpi1:
    html.append(f'<div class="kpi-card"><div class="label">{label}</div><div class="value">{val}</div></div>')
html.append('</div>')

html.append('<div class="kpi-row" id="kpi-eff-top">')
eff_kpis = [
    ("CAC", f"{cac:,} BDT", ""),
    ("CAC:LTV", cac_ltv, ""),
    ("Avg Rev/Cust", f"{avg_rev_cust:.2f}L", ""),
    ("MoM Growth", mom_growth, ""),
]
for label, val, sub in eff_kpis:
    html.append(f'<div class="kpi-card"><div class="label">{label}</div><div class="value accent">{val}</div></div>')
html.append('</div>')

# Budget vs Actual bar chart (top 10)
html.append('<div class="grid-2">')
html.append('<div class="chart-wrap"><h3>Budget vs Actual (Top 10 SBUs)</h3><canvas id="chartBudgetActual"></canvas></div>')

# SBU Scorecard
html.append('<div class="chart-wrap"><h3>SBU Scorecard</h3><div style="max-height:350px;overflow-y:auto;">')
html.append('<table id="tblScorecard"><thead><tr>')
for h in ["SBU","FY Budget","Q1","Expected Burn","ATL Actual","BTL Actual","Total Actual","Burn %","Revenue","ROMI","POs"]:
    html.append(f'<th>{h}</th>')
html.append('</tr></thead><tbody>')
for s in scorecard:
    slug = sbu_safe(s['name'])
    html.append(f'<tr data-sbu="{slug}">')
    html.append(f'<td><strong>{esc(s["name"])}</strong></td>')
    html.append(f'<td class="text-right">{s["total_fy"]:,.2f}</td>')
    html.append(f'<td class="text-right">{s["q1_total"]:,.2f}</td>')
    html.append(f'<td class="text-right">{s["expected_burn"]:,.2f}</td>')
    html.append(f'<td class="text-right">{s["act_atl"]:,.2f}</td>')
    html.append(f'<td class="text-right">{s["act_btl"]:,.2f}</td>')
    html.append(f'<td class="text-right">{s["act_total"]:,.2f}</td>')
    html.append(f'<td class="text-right">{s["burn_pct"]:.1f}%</td>')
    html.append(f'<td class="text-right">{s["rev"]:,.2f}</td>')
    html.append(f'<td class="text-right">{s["romi"]:.1f}x</td>')
    html.append(f'<td class="text-right">{s["pos"]}</td>')
    html.append('</tr>')
html.append('</tbody></table></div></div>')
html.append('</div>')  # close grid-2

html.append('</div>')  # close tab-all

# ==========================================
# TAB 2 - ATL Channels
# ==========================================
html.append('<div class="tab-content" id="tab-atl">')

# ATL KPI cards (6)
atl_kpi_labels = [
    "ATL Spend (Mapped)", "ATL FY Budget",
    "ATL Q1 Allocation", "Spend vs Q1 Budget",
    "ATL Service POs", "Share of Total Campaign"
]
html.append('<div class="kpi-row" id="kpi-atl">')
html.append(f'<div class="kpi-card" id="atl-kpi-0"><div class="label">{atl_kpi_labels[0]}</div><div class="value">6.69 Cr</div></div>')
html.append(f'<div class="kpi-card" id="atl-kpi-1"><div class="label">{atl_kpi_labels[1]}</div><div class="value">65.32 Cr</div></div>')
html.append(f'<div class="kpi-card" id="atl-kpi-2"><div class="label">{atl_kpi_labels[2]}</div><div class="value">13.49 Cr</div></div>')
html.append(f'<div class="kpi-card" id="atl-kpi-3"><div class="label">{atl_kpi_labels[3]}</div><div class="value">49.6%</div></div>')
html.append(f'<div class="kpi-card" id="atl-kpi-4"><div class="label">{atl_kpi_labels[4]}</div><div class="value">{len(atl_pos_list)} POs / {atl_po_total:,.4f} Cr</div></div>')
share_atl = (atl_j_mapped_total / campaign_total * 100) if campaign_total > 0 else 0
html.append(f'<div class="kpi-card" id="atl-kpi-5"><div class="label">{atl_kpi_labels[5]}</div><div class="value">{share_atl:.1f}%</div></div>')
html.append('</div>')

# NEW: ATL Spend by SBU chart + ATL Channel Split donut
html.append('<div class="grid-2">')
html.append('<div class="chart-wrap"><h3>ATL Spend by SBU</h3><canvas id="chartATLbySBU"></canvas></div>')
html.append('<div class="chart-wrap"><h3>ATL Channel Split</h3><div class="donut-wrap"><div><canvas id="chartATLDonut"></canvas></div><div><ul class="donut-legend" id="atlDonutLegend"></ul></div></div></div>')
html.append('</div>')

# ATL Journal entries table
html.append('<div class="chart-wrap"><h3>ATL Journal Entries (Jul-Aug 2026)</h3><div class="po-table-wrap">')
html.append('<table id="tblATLJournal"><thead><tr><th>SBU</th><th>Month</th><th>GL Account</th><th class="text-right">Amount (Cr)</th></tr></thead><tbody>')
for j in j_atl_list:
    nm = j_to_name.get(j['sbu'], None)
    if nm is None:
        nm = f"Other (ID:{j['sbu']})"
    slug = sbu_safe(nm)
    month_name = {7: "Jul 2026", 8: "Aug 2026"}.get(j['month'], f"M{j['month']}")
    html.append(f'<tr data-sbu="{slug}">')
    html.append(f'<td>{esc(nm)}</td>')
    html.append(f'<td>{month_name}</td>')
    html.append(f'<td style="font-size:0.75rem;">{esc(j["subgl"])}</td>')
    html.append(f'<td class="text-right">{j["amt"]:,.4f}</td>')
    html.append('</tr>')
html.append('</tbody></table></div></div>')

# ATL PO table - FULL list with all POs
html.append('<div class="chart-wrap"><h3>ATL Purchase Orders — Full List (' + str(len(atl_pos_list)) + ' POs)</h3><div class="po-table-wrap">')
html.append('<table id="tblATLPO"><thead><tr><th>PO #</th><th>Vendor</th><th>SBU</th><th>Date</th><th class="text-right">Value (Cr)</th><th class="text-right">GRN Recv (Cr)</th><th class="text-right">GRN%</th><th>Items</th><th>Status</th></tr></thead><tbody>')
for p in atl_pos_list:
    nm = resolve_sbu_name(p['bu'])
    slug = sbu_safe(nm)
    status = "Closed" if p['closed'] else "Open"
    badge_cls = "positive" if p['closed'] else "warning"
    grn_pct = (p['recv']/p['val']*100) if p['val']>0 else 0
    items_str = ", ".join(it['n'][:35] for it in p.get('items',[])[:3])
    html.append(f'<tr data-sbu="{slug}">')
    html.append(f'<td style="font-size:0.75rem;">{esc(p["po"])}</td>')
    html.append(f'<td>{esc(p["vendor"][:25])}</td>')
    html.append(f'<td>{esc(nm)}</td>')
    html.append(f'<td style="font-size:0.7rem;">{p["date"]}</td>')
    html.append(f'<td class="text-right">{p["val"]:,.4f}</td>')
    html.append(f'<td class="text-right">{p["recv"]:,.4f}</td>')
    html.append(f'<td class="text-right"><span class="badge {"positive" if grn_pct>50 else ("warning" if grn_pct>10 else "negative")}">{grn_pct:.1f}%</span></td>')
    html.append(f'<td style="font-size:0.7rem;max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="{esc(items_str)}">{esc(items_str[:80])}</td>')
    html.append(f'<td><span class="badge {badge_cls}">{status}</span></td>')
    html.append('</tr>')
html.append('</tbody></table></div></div>')

html.append('</div>')  # close tab-atl

# ==========================================
# TAB 3 - BTL Channels
# ==========================================
html.append('<div class="tab-content" id="tab-btl">')

# BTL KPI cards (6)
btl_kpi_labels_all = [
    "BTL PO Committed", "BTL FY Budget",
    "BTL Q1 Allocation", "Spend vs Q1 Budget",
    "Active BTL POs", "Share of Total Campaign"
]
html.append('<div class="kpi-row" id="kpi-btl">')
html.append(f'<div class="kpi-card" id="btl-kpi-0"><div class="label">{btl_kpi_labels_all[0]}</div><div class="value">{btl_total:,.2f} Cr</div></div>')
html.append(f'<div class="kpi-card" id="btl-kpi-1"><div class="label">{btl_kpi_labels_all[1]}</div><div class="value">40.87 Cr</div></div>')
html.append(f'<div class="kpi-card" id="btl-kpi-2"><div class="label">{btl_kpi_labels_all[2]}</div><div class="value">6.97 Cr</div></div>')
html.append(f'<div class="kpi-card" id="btl-kpi-3"><div class="label">{btl_kpi_labels_all[3]}</div><div class="value">11.3%</div></div>')
html.append(f'<div class="kpi-card" id="btl-kpi-4"><div class="label">{btl_kpi_labels_all[4]}</div><div class="value">{len(btl_pos_list)} POs</div></div>')
share_btl = (btl_total / campaign_total * 100) if campaign_total > 0 else 0
html.append(f'<div class="kpi-card" id="btl-kpi-5"><div class="label">{btl_kpi_labels_all[5]}</div><div class="value">{share_btl:.1f}%</div></div>')
html.append('</div>')

# BTL Campaign Type summary cards
html.append('<div class="section-title">BTL Campaign Type Breakdown</div>')
html.append('<div class="grid-2">')
# Donut chart
html.append('<div class="chart-wrap"><h3>BTL Campaign Mix</h3><div class="donut-wrap"><div><canvas id="chartBTLDonut"></canvas></div><div><ul class="donut-legend" id="btlLegend"></ul></div></div></div>')
# Summary cards
html.append('<div><div class="grid-4" id="btlCatCards">')
cat_colors = ["#6c8cff","#00d4aa","#ffa502","#ff4757","#a29bfe","#fd79a8","#00cec9"]
for i, (cat, cat_val) in enumerate(btl_categories):
    color = cat_colors[i % len(cat_colors)]
    html.append(f'<div class="card" style="border-left:3px solid {color};"><div class="label">{esc(cat)}</div><div class="value" style="font-size:1.1rem;">{cat_val:,.2f} Cr</div></div>')
html.append('</div></div>')
html.append('</div>')  # close grid-2

# NEW: BTL GRN Progress + BTL Vendor Spend
html.append('<div class="grid-2">')
html.append('<div class="chart-wrap"><h3>BTL GRN Progress (Top 10 POs)</h3><canvas id="chartBTLGRN"></canvas></div>')
html.append('<div class="chart-wrap"><h3>BTL Vendor Spend (Top 10)</h3><canvas id="chartBTLVendor"></canvas></div>')
html.append('</div>')

# BTL PO table - FULL list
html.append('<div class="chart-wrap"><h3>BTL Purchase Orders — Full List (' + str(len(btl_pos_list)) + ' POs)</h3><div class="po-table-wrap">')
html.append('<table id="tblBTLPO"><thead><tr><th>PO #</th><th>Vendor</th><th>SBU</th><th>Date</th><th>Campaign Type</th><th class="text-right">Value (Cr)</th><th class="text-right">BTL Amt (Cr)</th><th class="text-right">GRN%</th><th>Items</th><th>Status</th></tr></thead><tbody>')
# Simple BTL type classifier
BTL_TYPE_KW = {
    'Dealer Merchandise': ['t-shirt','polo','round neck','jersey','cap','hat','umbrella','mug','bag','dinner set'],
    'Dealer Incentive': ['gas stove','rice cooker','induction','kettle','iron','mixer grinder'],
    'Electrician/Mechanic Kit': ['electrician','hardware tool','tools bag'],
    'Farmer Training Kit': ['oxygen meter','hygrometer','thermometer','gloves','apron','gumboot','weight scale','foot batch'],
    'Consumer Sampling': ['soyabean','oral saline','flattened rice','chira','molasses','gur','lighter','laundry','turmeric','chilli','spice'],
    'POSM & Signage': ['light box','banner','backdrop','cutout','sticker','brochure','label','packing poly','gum tape'],
    'Event Materials': ['invitation','visiting card','folder','notebook','gift voucher','jersey'],
}
for p in btl_pos_list:
    nm = resolve_sbu_name(p['bu'])
    slug = sbu_safe(nm)
    status = "Closed" if p['closed'] else "Open"
    badge_cls = "positive" if p['closed'] else "warning"
    grn_pct = (p['recv']/p['val']*100) if p['val']>0 else 0
    items_str = ", ".join(it['n'][:35] for it in p.get('items',[])[:3])
    # Determine BTL campaign type from items
    ctype = "General BTL"
    for cat, kws in BTL_TYPE_KW.items():
        for it in p.get('items',[]):
            if any(kw in it['n'].lower() for kw in kws):
                ctype = cat
                break
        if ctype != "General BTL": break
    html.append(f'<tr data-sbu="{slug}">')
    html.append(f'<td style="font-size:0.72rem;">{esc(p["po"])}</td>')
    html.append(f'<td>{esc(p["vendor"][:25])}</td>')
    html.append(f'<td>{esc(nm)}</td>')
    html.append(f'<td style="font-size:0.7rem;">{p["date"]}</td>')
    html.append(f'<td style="font-size:0.7rem;">{ctype}</td>')
    html.append(f'<td class="text-right">{p["val"]:,.4f}</td>')
    html.append(f'<td class="text-right">{p["btl"]:,.4f}</td>')
    html.append(f'<td class="text-right"><span class="badge {"positive" if grn_pct>50 else ("warning" if grn_pct>10 else "negative")}">{grn_pct:.1f}%</span></td>')
    html.append(f'<td style="font-size:0.7rem;max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="{esc(items_str)}">{esc(items_str[:70])}</td>')
    html.append(f'<td><span class="badge {badge_cls}">{status}</span></td>')
    html.append('</tr>')
html.append('</tbody></table></div></div>')

html.append('</div>')  # close tab-btl

# ==========================================
# TAB 4 - EFFICIENCY
# ==========================================
html.append('<div class="tab-content" id="tab-eff">')

html.append('<div class="eff-grid" id="kpi-eff">')
eff12_labels = [
    "Total Campaign Spend", "Total Revenue", "Combined ROMI",
    "CAC", "CAC:LTV Ratio", "Avg Revenue/Customer",
    "MoM Growth", "ATL Efficiency", "BTL Efficiency",
    "Active POs", "Burn vs Expected", "Q1 Utilisation"
]
eff12_values = [
    f"{campaign_total:,.2f} Cr",
    f"{total_rev:,.2f} Cr",
    f"{total_rev / campaign_total:,.1f}x" if campaign_total > 0 else "N/A",
    f"{cac:,} BDT",
    cac_ltv,
    f"{avg_rev_cust:,.2f}L",
    mom_growth,
    f"{total_rev / atl_total:,.1f}x" if atl_total > 0 else "N/A",
    f"{total_rev / btl_total:,.1f}x" if btl_total > 0 else "N/A",
    str(total_pos),
    f"{campaign_total / 9.61 * 100:,.1f}%" if campaign_total > 0 else "0%",
    f"{campaign_total / 21.57 * 100:,.1f}%",
]
for i, (label, val) in enumerate(zip(eff12_labels, eff12_values)):
    html.append(f'<div class="kpi-card" id="eff-kpi-{i}"><div class="label">{label}</div><div class="value accent">{val}</div></div>')
html.append('</div>')

# 13-month revenue trend
html.append('<div class="chart-wrap"><h3>13-Month Revenue Trend (Jul 25 - Aug 26)</h3><canvas id="chartRevenueTrend"></canvas></div>')

# 6 Blocker signals
html.append('<div class="section-title">Blocker Signals</div>')
html.append('<div class="grid-3" id="blockerGrid">')
blockers = [
    ("critical", "Over-Expected Burn", "Multiple SBUs (Cement, Essential) burning significantly above expected rate. Cement at 306% of expected."),
    ("warning", "GRN Backlog", "4+ SBUs have active POs with zero or minimal GRN receipts. Goods received but not booked in ERP."),
    ("warning", "Zero Campaign Spend", "5+ SBUs (Agri Life, Mediquip, Pharmacy, Landmark, etc.) show zero actual campaign spend against allocated budget."),
    ("warning", "Low ROMI SBUs", "Consumer Electronics (ORCA) at 49.5x ROMI on very low revenue base. Next Jobz at negligible 0.16Cr revenue."),
    ("critical", "Budget vs Actual Gap", "Total FY budget of 111.06Cr vs Q1 expected burn of 9.61Cr — only 8.7% of FY budget expected in Q1."),
    ("warning", "Journal vs PO Mismatch", "ATL journal entries (14.53Cr) significantly exceed ATL POs (0.06Cr). Large spend flowing outside PO system."),
]
for lvl, title, desc in blockers:
    html.append(f'<div class="blocker-card" data-blocker-lvl="{lvl}"><div class="bl-lvl" style="color:var(--{lvl});">{lvl}</div><div class="bl-title">{title}</div><div class="bl-desc">{desc}</div></div>')
html.append('</div>')

html.append('</div>')  # close tab-eff

# ==========================================
# TAB 5 - NBA (Next Best Action)
# ==========================================
html.append('<div class="tab-content" id="tab-nba">')
html.append('<div class="chart-wrap"><h3>AI-Generated Next Best Actions (23 Recommendations)</h3></div>')
html.append('<div class="grid-3" id="nbaGrid">')
for n in nba_list:
    sbu_name = n['sbu']
    slug = sbu_safe(sbu_name)
    cls = n['lvl']
    html.append(f'<div class="nba-card {cls}" data-sbu="{slug}">')
    html.append(f'<div class="nba-title">{esc(n["title"])}</div>')
    html.append(f'<div style="font-size:0.7rem;color:var(--muted);margin-bottom:4px;">{esc(sbu_name)}</div>')
    html.append(f'<div class="nba-msg">{esc(n["msg"])}</div>')
    html.append(f'<div class="nba-act">&rarr; {esc(n["act"])}</div>')
    html.append('</div>')
html.append('</div>')
html.append('</div>')  # close tab-nba

# ==========================================
# TAB 6 - GAP ANALYSIS
# ==========================================
html.append('<div class="tab-content" id="tab-gap">')

html.append('<div class="grid-2">')

# People blockers
html.append('<div class="chart-wrap gap-section" id="gap-people"><h4>People Blockers</h4>')
people = [
    ("Approval Delays", "PO approval cycle exceeding 9 days on average. Marketing teams waiting for commercial approval before campaign execution."),
    ("Skill Gap in Digital", "Limited in-house expertise for GA4, Meta Pixel, and CAPI implementation across SBUs. Reliance on external agencies slows execution."),
    ("Cross-Functional Misalignment", "Marketing, Sales, and Supply Chain operating in silos with no shared campaign calendar. Campaigns launched without stock readiness."),
]
for title, desc in people:
    html.append(f'<div class="blocker-card"><div class="bl-title">{title}</div><div class="bl-desc">{desc}</div></div>')
html.append('</div>')

# Process blockers
html.append('<div class="chart-wrap gap-section" id="gap-process"><h4>Process Blockers</h4>')
process = [
    ("Slow GRN Processing", "Goods received at depot but GRN not booked in ERP for 6-14 days. Impacts vendor payment and accrual accuracy."),
    ("Manual Reporting", "Campaign performance tracked via spreadsheets. No centralized real-time dashboard before this portal."),
    ("No PO-Budget Linkage", "POs raised without automatic budget check. Multiple instances of PO value exceeding available Q1 budget."),
    ("Vendor Onboarding Friction", "New vendor registration takes 15-20 days. Slows BTL material procurement for time-sensitive campaigns."),
]
for title, desc in process:
    html.append(f'<div class="blocker-card"><div class="bl-title">{title}</div><div class="bl-desc">{desc}</div></div>')
html.append('</div>')

# Technology blockers
html.append('<div class="chart-wrap gap-section" id="gap-tech"><h4>Technology Blockers</h4>')
tech = [
    ("ERP Integration Gaps", "Journal entries not linked to campaign IDs. Spend classification requires manual review of GL line items."),
    ("No Campaign ROI Attribution", "Revenue attribution to specific campaigns not automated. ROMI calculated at SBU level, not campaign level."),
    ("Data Warehouse Sync Delays", "DWH syncs every ~4 hours from ERP. Real-time campaign monitoring not possible during business-critical windows."),
    ("Legacy Approval Workflow", "Paper-based approval workflow for PR→PO→GRN cycle. No mobile approval capability for field teams."),
]
for title, desc in tech:
    html.append(f'<div class="blocker-card"><div class="bl-title">{title}</div><div class="bl-desc">{desc}</div></div>')
html.append('</div>')

html.append('</div>')  # close grid-2

# Impact summary table
html.append('<div class="chart-wrap"><h3>Impact Summary</h3>')
html.append('<table><thead><tr><th>Category</th><th>Issue</th><th class="text-right">Revenue Impact (Cr)</th><th>Severity</th></tr></thead><tbody>')
impact_rows = [
    ("People", "Approval Delays", "4.2", "High"),
    ("People", "Digital Skill Gap", "1.8", "Medium"),
    ("Process", "Slow GRN Processing", "2.5", "Medium"),
    ("Process", "No PO-Budget Linkage", "3.1", "High"),
    ("Technology", "No Campaign ROI Attribution", "5.6", "Critical"),
    ("Technology", "ERP Integration Gaps", "2.3", "Medium"),
]
for cat, issue, rev_imp, sev in impact_rows:
    sev_cls = {"High": "warning", "Medium": "neutral", "Critical": "critical"}.get(sev, "neutral")
    html.append(f'<tr><td>{cat}</td><td>{issue}</td><td class="text-right">{rev_imp}</td><td><span class="badge {sev_cls}">{sev}</span></td></tr>')
html.append('</tbody></table></div>')

# 5 recommended actions
html.append('<div class="chart-wrap"><h3>Recommended Actions</h3>')
actions = [
    "Implement automated PO-budget linkage with real-time budget consumption alerts — target Q2 FY27",
    "Deploy campaign-level ROI attribution using UTM parameters and CRM integration — target Q2 FY27",
    "Reduce PO approval cycle from 9 days to 3 days through workflow automation and mobile approvals",
    "Conduct digital upskilling workshop for all 15 SBU marketing leads on GA4, GTM, and Meta CAPI",
    "Establish weekly cross-functional campaign readiness review (Marketing + Sales + SCM) every Thursday",
]
for i, act in enumerate(actions, 1):
    html.append(f'<div class="action-row"><div class="action-num">{i}</div><div class="action-text">{act}</div></div>')
html.append('</div>')

html.append('</div>')  # close tab-gap

# ==========================================
# JAVASCRIPT (built with .replace() for safe Python→JS injection)
# ==========================================

# Pre-compute all strings to inject
_replacements = {
    '__ATL_TOTAL__': str(atl_total),
    '__BTL_TOTAL__': str(btl_total),
    '__CAMPAIGN_TOTAL__': str(campaign_total),
    '__TOTAL_POS__': str(total_pos),
    '__TOTAL_REV__': str(total_rev),
    '__EST_CUSTOMERS__': str(estimated_total_customers),
    '__ATL_J_MAPPED__': str(atl_j_mapped_total),
    '__ATL_PO_VAL_TOTAL__': str(atl_po_val_total),
    '__CAC_STR__': f"{cac:,}",
    '__CAC_LTV_STR__': cac_ltv,
    '__AVG_REV_CUST_STR__': f"{avg_rev_cust:.2f}",
    '__MOM_GROWTH_STR__': mom_growth,
    '__ATL_PO_ALL_S__': f"{len(atl_pos_list)} POs / {atl_po_val_total:,.4f} Cr",
    '__BTL_PO_ALL_S__': f"{len(btl_pos_list)} POs",
    '__SBU_MAP__': json.dumps(sbu_js_map),
    '__BAR_LABELS__': json.dumps(bar_labels),
    '__BAR_BUDGET__': json.dumps(bar_budget),
    '__BAR_ACTUAL__': json.dumps(bar_actual),
    '__ATL_SBU_LABELS__': json.dumps([x[0] for x in atl_sbu_data]),
    '__ATL_SBU_VALUES__': json.dumps([x[1] for x in atl_sbu_data]),
    '__ATL_CH_LABELS__': json.dumps(atl_channel_labels),
    '__ATL_CH_VALUES__': json.dumps(atl_channel_data),
    '__BTL_CAT_LABELS__': json.dumps([c[0] for c in btl_categories]),
    '__BTL_CAT_VALUES__': json.dumps([c[1] for c in btl_categories]),
    '__BTL_CAT_COLORS__': json.dumps(cat_colors[:len(btl_categories)]),
    '__BTL_GRN_LABELS__': json.dumps(btl_grn_labels),
    '__BTL_GRN_DATA__': json.dumps([p.get('recv_pct', 0) for p in btl_grn_data]),
    '__BTL_GRN_COLORS__': json.dumps(['#00d4aa' if p.get('recv_pct', 0) > 5 else '#ff4757' for p in btl_grn_data]),
    '__VENDOR_LABELS__': json.dumps([v[0] for v in top_vendors]),
    '__VENDOR_DATA__': json.dumps([v[1] for v in top_vendors]),
    '__MONTH_LABELS__': json.dumps([m[0] for m in monthly_rev]),
    '__MONTH_DATA__': json.dumps([m[1] for m in monthly_rev]),
}

_js = """
<script>
// ── Global chart references ──
let chartBudgetActual = null;
let chartBTLDonut = null;
let chartRevenueTrend = null;
let chartATLbySBU = null;
let chartATLDonut = null;
let chartBTLGRN = null;
let chartBTLVendor = null;

// ── Global totals (for share calculations) ──
const GLOBALS = {
  atl_total: __ATL_TOTAL__,
  btl_total: __BTL_TOTAL__,
  campaign_total: __CAMPAIGN_TOTAL__,
  total_pos: __TOTAL_POS__,
  total_rev: __TOTAL_REV__,
  estimated_total_customers: __EST_CUSTOMERS__,
  atl_j_mapped_total: __ATL_J_MAPPED__,
  atl_po_val_total: __ATL_PO_VAL_TOTAL__,
};
const CAC_VAL = "__CAC_STR__";
const CAC_LTV = "__CAC_LTV_STR__";
const AVG_REV_CUST = "__AVG_REV_CUST_STR__";
const MOM_GROWTH = "__MOM_GROWTH_STR__";
const ATL_PO_ALL_STR = "__ATL_PO_ALL_S__";
const BTL_PO_ALL_STR = "__BTL_PO_ALL_S__";

// ── Per-SBU data ──
window.SBU_MAP = __SBU_MAP__;

// ── Tab switching with lazy chart init ──
const chartInits = {
  'tab-all': ['chartBudgetActual'],
  'tab-atl': ['chartATLbySBU', 'chartATLDonut'],
  'tab-btl': ['chartBTLDonut', 'chartBTLGRN', 'chartBTLVendor'],
  'tab-eff': ['chartRevenueTrend'],
  'tab-nba': [],
  'tab-gap': []
};

function openTab(evt, tabId) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  evt.currentTarget.classList.add('active');

  const charts = chartInits[tabId] || [];
  charts.forEach(cid => {
    if (cid === 'chartBudgetActual' && !chartBudgetActual) initBudgetActualChart();
    if (cid === 'chartBTLDonut' && !chartBTLDonut) initBTLDonutChart();
    if (cid === 'chartRevenueTrend' && !chartRevenueTrend) initRevenueTrendChart();
    if (cid === 'chartATLbySBU' && !chartATLbySBU) initATLbySBUChart();
    if (cid === 'chartATLDonut' && !chartATLDonut) initATLDonutChart();
    if (cid === 'chartBTLGRN' && !chartBTLGRN) initBTLGRNChart();
    if (cid === 'chartBTLVendor' && !chartBTLVendor) initBTLVendorChart();
  });
}

// ── SBU filter ──
function filterSBU() {
  const val = document.getElementById('sbuFilter').value;
  const noteEls = document.querySelectorAll('.filter-note');
  const noteText = val === 'all' ? '' : 'Showing data for selected SBU only. KPI values reflect SBU-specific metrics.';
  noteEls.forEach(el => { el.textContent = noteText; el.style.display = val === 'all' ? 'none' : 'block'; });

  // Filter ALL data-sbu elements
  document.querySelectorAll('[data-sbu]').forEach(el => {
    el.style.display = (val === 'all' || el.getAttribute('data-sbu') === val) ? '' : 'none';
  });

  // Update KPIs across ALL tabs
  updateAllTabKPIs(val);
}

// ── Update KPIs for all tabs based on SBU filter ──
function updateAllTabKPIs(val) {
  updateTabAllKPIs(val);
  updateTabATLKPIs(val);
  updateTabBTLKPIs(val);
  updateTabEffKPIs(val);
  updateTabNbaCards(val);
}

// ── TAB ALL KPIs ──
function updateTabAllKPIs(val) {
  const execEl = document.getElementById('kpi-exec');
  const effTopEl = document.getElementById('kpi-eff-top');

  if (val === 'all') {
    execEl.innerHTML = `
      <div class="kpi-card"><div class="label">FY Budget</div><div class="value">111.06 Cr</div></div>
      <div class="kpi-card"><div class="label">Q1 Allocation</div><div class="value">21.57 Cr</div></div>
      <div class="kpi-card"><div class="label">Expected Burn</div><div class="value">9.61 Cr</div></div>
      <div class="kpi-card"><div class="label">ATL Spend</div><div class="value">${GLOBALS.atl_total.toFixed(2)} Cr</div></div>
      <div class="kpi-card"><div class="label">BTL Spend</div><div class="value">${GLOBALS.btl_total.toFixed(2)} Cr</div></div>
      <div class="kpi-card"><div class="label">Total Campaign</div><div class="value">${GLOBALS.campaign_total.toFixed(2)} Cr</div></div>
      <div class="kpi-card"><div class="label">Revenue</div><div class="value">${GLOBALS.total_rev.toFixed(2)} Cr</div></div>
      <div class="kpi-card"><div class="label">Active POs</div><div class="value">${GLOBALS.total_pos}</div></div>
    `;
    effTopEl.innerHTML = `
      <div class="kpi-card"><div class="label">CAC</div><div class="value accent">${CAC_VAL} BDT</div></div>
      <div class="kpi-card"><div class="label">CAC:LTV</div><div class="value accent">${CAC_LTV}</div></div>
      <div class="kpi-card"><div class="label">Avg Rev/Cust</div><div class="value accent">${AVG_REV_CUST}L</div></div>
      <div class="kpi-card"><div class="label">MoM Growth</div><div class="value accent">${MOM_GROWTH}</div></div>
    `;
  } else {
    const d = window.SBU_MAP[val];
    if (!d) return;
    execEl.innerHTML = `
      <div class="kpi-card"><div class="label">FY Budget</div><div class="value">${d.total_fy.toFixed(2)} Cr</div></div>
      <div class="kpi-card"><div class="label">Q1 Allocation</div><div class="value">${d.q1_total.toFixed(2)} Cr</div></div>
      <div class="kpi-card"><div class="label">Expected Burn</div><div class="value">${d.expected_burn.toFixed(2)} Cr</div></div>
      <div class="kpi-card"><div class="label">ATL Spend</div><div class="value">${d.act_atl.toFixed(2)} Cr</div></div>
      <div class="kpi-card"><div class="label">BTL Spend</div><div class="value">${d.act_btl.toFixed(2)} Cr</div></div>
      <div class="kpi-card"><div class="label">Total Campaign</div><div class="value">${d.act_total.toFixed(2)} Cr</div></div>
      <div class="kpi-card"><div class="label">Revenue</div><div class="value">${d.rev.toFixed(2)} Cr</div></div>
      <div class="kpi-card"><div class="label">Active POs</div><div class="value">${d.pos}</div></div>
    `;
    effTopEl.innerHTML = `
      <div class="kpi-card"><div class="label">Burn Rate</div><div class="value accent">${d.burn_pct.toFixed(1)}%</div></div>
      <div class="kpi-card"><div class="label">ROMI</div><div class="value accent">${d.romi.toFixed(1)}x</div></div>
      <div class="kpi-card"><div class="label">PO Committed</div><div class="value accent">${(d.act_total||0).toFixed(2)} Cr</div></div>
      <div class="kpi-card"><div class="label">Budget Remaining</div><div class="value accent">${(d.total_fy - d.act_total).toFixed(2)} Cr</div></div>
    `;
  }
}

// ── TAB ATL KPIs ──
function updateTabATLKPIs(val) {
  if (val === 'all') {
    document.getElementById('atl-kpi-0').querySelector('.value').textContent = '6.69 Cr';
    document.getElementById('atl-kpi-1').querySelector('.value').textContent = '65.32 Cr';
    document.getElementById('atl-kpi-2').querySelector('.value').textContent = '13.49 Cr';
    document.getElementById('atl-kpi-3').querySelector('.value').textContent = '49.6%';
    document.getElementById('atl-kpi-4').querySelector('.value').textContent = ATL_PO_ALL_STR;
    const share = GLOBALS.campaign_total > 0 ? (6.69 / GLOBALS.campaign_total * 100) : 0;
    document.getElementById('atl-kpi-5').querySelector('.value').textContent = share.toFixed(1) + '%';
  } else {
    const d = window.SBU_MAP[val];
    if (!d) return;
    document.getElementById('atl-kpi-0').querySelector('.value').textContent = d.act_atl.toFixed(2) + ' Cr';
    document.getElementById('atl-kpi-1').querySelector('.value').textContent = (d.atl_fy || 0).toFixed(2) + ' Cr';
    document.getElementById('atl-kpi-2').querySelector('.value').textContent = (d.q1_atl || 0).toFixed(2) + ' Cr';
    const vsQ1 = d.q1_atl > 0 ? (d.act_atl / d.q1_atl * 100) : 0;
    document.getElementById('atl-kpi-3').querySelector('.value').textContent = vsQ1.toFixed(1) + '%';
    document.getElementById('atl-kpi-4').querySelector('.value').textContent = d.atl_po_count + ' POs / ' + d.atl_po_val.toFixed(4) + ' Cr';
    const share = GLOBALS.campaign_total > 0 ? (d.act_atl / GLOBALS.campaign_total * 100) : 0;
    document.getElementById('atl-kpi-5').querySelector('.value').textContent = share.toFixed(1) + '%';
  }
}

// ── TAB BTL KPIs ──
function updateTabBTLKPIs(val) {
  if (val === 'all') {
    document.getElementById('btl-kpi-0').querySelector('.value').textContent = '0.79 Cr';
    document.getElementById('btl-kpi-1').querySelector('.value').textContent = '40.87 Cr';
    document.getElementById('btl-kpi-2').querySelector('.value').textContent = '6.97 Cr';
    document.getElementById('btl-kpi-3').querySelector('.value').textContent = '11.3%';
    document.getElementById('btl-kpi-4').querySelector('.value').textContent = BTL_PO_ALL_STR;
    const share = GLOBALS.campaign_total > 0 ? (0.79 / GLOBALS.campaign_total * 100) : 0;
    document.getElementById('btl-kpi-5').querySelector('.value').textContent = share.toFixed(1) + '%';
  } else {
    const d = window.SBU_MAP[val];
    if (!d) return;
    document.getElementById('btl-kpi-0').querySelector('.value').textContent = d.act_btl.toFixed(2) + ' Cr';
    document.getElementById('btl-kpi-1').querySelector('.value').textContent = (d.btl_fy || 0).toFixed(2) + ' Cr';
    document.getElementById('btl-kpi-2').querySelector('.value').textContent = (d.q1_btl || 0).toFixed(2) + ' Cr';
    const vsQ1 = d.q1_btl > 0 ? (d.act_btl / d.q1_btl * 100) : 0;
    document.getElementById('btl-kpi-3').querySelector('.value').textContent = vsQ1.toFixed(1) + '%';
    document.getElementById('btl-kpi-4').querySelector('.value').textContent = d.btl_po_count + ' POs';
    const share = GLOBALS.campaign_total > 0 ? (d.act_btl / GLOBALS.campaign_total * 100) : 0;
    document.getElementById('btl-kpi-5').querySelector('.value').textContent = share.toFixed(1) + '%';
  }
}

// ── TAB EFFICIENCY KPIs ──
function updateTabEffKPIs(val) {
  const effContainer = document.getElementById('kpi-eff');
  if (!effContainer) return;

  if (val === 'all') {
    effContainer.innerHTML = `
      <div class="kpi-card"><div class="label">Total Campaign Spend</div><div class="value accent">${GLOBALS.campaign_total.toFixed(2)} Cr</div></div>
      <div class="kpi-card"><div class="label">Total Revenue</div><div class="value accent">${GLOBALS.total_rev.toFixed(2)} Cr</div></div>
      <div class="kpi-card"><div class="label">Combined ROMI</div><div class="value accent">${GLOBALS.campaign_total > 0 ? (GLOBALS.total_rev / GLOBALS.campaign_total).toFixed(1) + 'x' : 'N/A'}</div></div>
      <div class="kpi-card"><div class="label">CAC</div><div class="value accent">${CAC_VAL} BDT</div></div>
      <div class="kpi-card"><div class="label">CAC:LTV Ratio</div><div class="value accent">${CAC_LTV}</div></div>
      <div class="kpi-card"><div class="label">Avg Revenue/Customer</div><div class="value accent">${AVG_REV_CUST}L</div></div>
      <div class="kpi-card"><div class="label">MoM Growth</div><div class="value accent">${MOM_GROWTH}</div></div>
      <div class="kpi-card"><div class="label">ATL Efficiency</div><div class="value accent">${GLOBALS.atl_total > 0 ? (GLOBALS.total_rev / GLOBALS.atl_total).toFixed(1) + 'x' : 'N/A'}</div></div>
      <div class="kpi-card"><div class="label">BTL Efficiency</div><div class="value accent">${GLOBALS.btl_total > 0 ? (GLOBALS.total_rev / GLOBALS.btl_total).toFixed(1) + 'x' : 'N/A'}</div></div>
      <div class="kpi-card"><div class="label">Active POs</div><div class="value accent">${GLOBALS.total_pos}</div></div>
      <div class="kpi-card"><div class="label">Burn vs Expected</div><div class="value accent">${GLOBALS.campaign_total > 0 ? (GLOBALS.campaign_total / 9.61 * 100).toFixed(1) : '0'}%</div></div>
      <div class="kpi-card"><div class="label">Q1 Utilisation</div><div class="value accent">${(GLOBALS.campaign_total / 21.57 * 100).toFixed(1)}%</div></div>
    `;
  } else {
    const d = window.SBU_MAP[val];
    if (!d) return;
    const rev = d.rev || 0;
    const spend = d.act_total || 0;
    const romi_val = spend > 0 ? (rev / spend).toFixed(1) + 'x' : 'N/A';
    const atl_eff = d.act_atl > 0 ? (rev / d.act_atl).toFixed(1) + 'x' : 'N/A';
    const btl_eff = d.act_btl > 0 ? (rev / d.act_btl).toFixed(1) + 'x' : 'N/A';
    const burn_vs_exp = d.expected_burn > 0 ? (spend / d.expected_burn * 100).toFixed(1) : '0';
    const q1_util = d.q1_total > 0 ? (spend / d.q1_total * 100).toFixed(1) : '0';
    effContainer.innerHTML = `
      <div class="kpi-card"><div class="label">Campaign Spend</div><div class="value accent">${spend.toFixed(2)} Cr</div></div>
      <div class="kpi-card"><div class="label">Revenue</div><div class="value accent">${d.rev.toFixed(2)} Cr</div></div>
      <div class="kpi-card"><div class="label">ROMI</div><div class="value accent">${romi_val}</div></div>
      <div class="kpi-card"><div class="label">Burn Rate</div><div class="value accent">${d.burn_pct.toFixed(1)}%</div></div>
      <div class="kpi-card"><div class="label">FY Budget</div><div class="value accent">${d.total_fy.toFixed(2)} Cr</div></div>
      <div class="kpi-card"><div class="label">Q1 Allocation</div><div class="value accent">${d.q1_total.toFixed(2)} Cr</div></div>
      <div class="kpi-card"><div class="label">ATL Spend</div><div class="value accent">${d.act_atl.toFixed(2)} Cr</div></div>
      <div class="kpi-card"><div class="label">BTL Spend</div><div class="value accent">${d.act_btl.toFixed(2)} Cr</div></div>
      <div class="kpi-card"><div class="label">ATL Efficiency</div><div class="value accent">${atl_eff}</div></div>
      <div class="kpi-card"><div class="label">BTL Efficiency</div><div class="value accent">${btl_eff}</div></div>
      <div class="kpi-card"><div class="label">Burn vs Expected</div><div class="value accent">${burn_vs_exp}%</div></div>
      <div class="kpi-card"><div class="label">Q1 Utilisation</div><div class="value accent">${q1_util}%</div></div>
    `;
  }
}

// ── TAB NBA cards ──
function updateTabNbaCards(val) {
  const cards = document.querySelectorAll('#nbaGrid .nba-card');
  cards.forEach(card => {
    if (val === 'all') {
      card.style.display = '';
    } else {
      card.style.display = card.getAttribute('data-sbu') === val ? '' : 'none';
    }
  });
}

// ── CHART: Budget vs Actual ──
function initBudgetActualChart() {
  const ctx = document.getElementById('chartBudgetActual').getContext('2d');
  chartBudgetActual = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: __BAR_LABELS__,
      datasets: [
        { label: 'FY Budget', data: __BAR_BUDGET__, backgroundColor: '#6c8cff88', borderColor: '#6c8cff', borderWidth: 1 },
        { label: 'Actual Spend', data: __BAR_ACTUAL__, backgroundColor: '#00d4aa88', borderColor: '#00d4aa', borderWidth: 1 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { labels: { color: '#6b7a99', font: { size: 11 } } } },
      scales: {
        x: { ticks: { color: '#6b7a99', font: { size: 10 }, maxRotation: 45 }, grid: { color: '#1a2540' } },
        y: { ticks: { color: '#6b7a99', callback: v => v + ' Cr' }, grid: { color: '#1a2540' } }
      }
    }
  });
}

// ── CHART: ATL Spend by SBU ──
function initATLbySBUChart() {
  const ctx = document.getElementById('chartATLbySBU').getContext('2d');
  chartATLbySBU = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: __ATL_SBU_LABELS__,
      datasets: [
        { label: 'ATL Spend (Cr)', data: __ATL_SBU_VALUES__, backgroundColor: '#6c8cff88', borderColor: '#6c8cff', borderWidth: 1 }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ctx.raw.toFixed(2) + ' Cr' } } },
      scales: {
        x: { ticks: { color: '#6b7a99', font: { size: 10 }, callback: v => v + ' Cr' }, grid: { color: '#1a2540' } },
        y: { ticks: { color: '#6b7a99', font: { size: 10 } }, grid: { display: false } }
      }
    }
  });
}

// ── CHART: ATL Channel Split Donut ──
const atlChannelLabels = __ATL_CH_LABELS__;
const atlChannelValues = __ATL_CH_VALUES__;
const atlChannelColors = ['#6c8cff', '#00d4aa', '#ffa502'];

function initATLDonutChart() {
  const ctx = document.getElementById('chartATLDonut').getContext('2d');
  chartATLDonut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: atlChannelLabels,
      datasets: [{ data: atlChannelValues, backgroundColor: atlChannelColors, borderColor: '#060b14', borderWidth: 2 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ctx.label + ': ' + ctx.raw.toFixed(2) + ' Cr' } }
      }
    }
  });
  const legendEl = document.getElementById('atlDonutLegend');
  legendEl.innerHTML = atlChannelLabels.map((l, i) =>
    '<li><span class="dot" style="background:' + atlChannelColors[i] + '"></span>' + l + ' (' + atlChannelValues[i].toFixed(2) + ' Cr)</li>'
  ).join('');
}

// ── CHART: BTL Campaign Mix Donut ──
const btlCatLabels = __BTL_CAT_LABELS__;
const btlCatValues = __BTL_CAT_VALUES__;
const btlCatColors = __BTL_CAT_COLORS__;

function initBTLDonutChart() {
  const ctx = document.getElementById('chartBTLDonut').getContext('2d');
  chartBTLDonut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: btlCatLabels,
      datasets: [{ data: btlCatValues, backgroundColor: btlCatColors, borderColor: '#060b14', borderWidth: 2 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ctx.label + ': ' + ctx.raw.toFixed(2) + ' Cr' } }
      }
    }
  });
  const legendEl = document.getElementById('btlLegend');
  legendEl.innerHTML = btlCatLabels.map((l, i) =>
    '<li><span class="dot" style="background:' + btlCatColors[i] + '"></span>' + l + ' (' + btlCatValues[i].toFixed(2) + ' Cr)</li>'
  ).join('');
}

// ── CHART: BTL GRN Progress ──
function initBTLGRNChart() {
  const ctx = document.getElementById('chartBTLGRN').getContext('2d');
  chartBTLGRN = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: __BTL_GRN_LABELS__,
      datasets: [{
        label: 'GRN %',
        data: __BTL_GRN_DATA__,
        backgroundColor: __BTL_GRN_COLORS__,
        borderColor: '#060b14', borderWidth: 1
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ctx.raw.toFixed(1) + '% GRN' } }
      },
      scales: {
        x: { ticks: { color: '#6b7a99', font: { size: 10 }, callback: v => v + '%' }, grid: { color: '#1a2540' }, max: 100 },
        y: { ticks: { color: '#6b7a99', font: { size: 9 } }, grid: { display: false } }
      }
    }
  });
}

// ── CHART: BTL Vendor Spend ──
function initBTLVendorChart() {
  const ctx = document.getElementById('chartBTLVendor').getContext('2d');
  chartBTLVendor = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: __VENDOR_LABELS__,
      datasets: [{
        label: 'BTL Spend (Cr)',
        data: __VENDOR_DATA__,
        backgroundColor: '#00d4aa88', borderColor: '#00d4aa', borderWidth: 1
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ctx.raw.toFixed(4) + ' Cr' } }
      },
      scales: {
        x: { ticks: { color: '#6b7a99', font: { size: 10 }, callback: v => v + ' Cr' }, grid: { color: '#1a2540' } },
        y: { ticks: { color: '#6b7a99', font: { size: 10 } }, grid: { display: false } }
      }
    }
  });
}

// ── CHART: Revenue Trend ──
function initRevenueTrendChart() {
  const ctx = document.getElementById('chartRevenueTrend').getContext('2d');
  chartRevenueTrend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: __MONTH_LABELS__,
      datasets: [{
        label: 'Revenue (Cr)',
        data: __MONTH_DATA__,
        borderColor: '#00d4aa',
        backgroundColor: 'rgba(0,212,170,0.08)',
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: '#00d4aa'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { labels: { color: '#6b7a99', font: { size: 11 } } } },
      scales: {
        x: { ticks: { color: '#6b7a99', font: { size: 10 }, maxRotation: 45 }, grid: { color: '#1a2540' } },
        y: { ticks: { color: '#6b7a99', callback: v => v + ' Cr' }, grid: { color: '#1a2540' } }
      }
    }
  });
}

// ── Initialize on page load ──
document.addEventListener('DOMContentLoaded', function() {
  initBudgetActualChart();
});
</script>
</body>
</html>
"""

# Apply all replacements
for k, v in _replacements.items():
    _js = _js.replace(k, v)

html.append(_js)

# ---------- write output ----------
result = '\n'.join(html)
os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
with open(OUT_PATH, 'w', encoding='utf-8') as f:
    f.write(result)

fsize = os.path.getsize(OUT_PATH)
print(f"Written: {OUT_PATH}")
print(f"Size: {fsize:,} bytes ({fsize/1024:.1f} KB)")
