/* collect.js — turn saved ERP tool-output files into data/panel_full.json
 *
 * Input : data/scope.json   { "firstMonth": "2022-03", "lastMonth": "2026-11",
 *                             "buCode": 144, "expectedSkus": 1033 }
 *         tool-output JSON files written by the ERP gateway (one per month)
 * Output: data/panel_full.json  { months:[...], rows:[{m,c,n,q,g,v,d,f}] }
 *
 * Usage : node collect.js
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const ROOT = __dirname;
const SCOPE = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data", "scope.json"), "utf8").replace(/^\uFEFF/, "")); }
  catch (e) { console.error("data/scope.json is required: {firstMonth,lastMonth,buCode,expectedSkus}"); process.exit(1); }
})();

const DIR = process.env.TOOL_OUTPUT_DIR ||
  path.join(os.homedir(), ".local", "share", "opencode", "tool-output");

/* ---- month range ---- */
function monthsBetween(a, b) {
  const out = [];
  let [y, m] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  while (y < by || (y === by && m <= bm)) {
    out.push(y + "-" + String(m).padStart(2, "0"));
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}
const MONTHS = monthsBetween(SCOPE.firstMonth, SCOPE.lastMonth);

/* ---- find candidate files ---- */
const files = fs.readdirSync(DIR)
  .map(f => { const p = path.join(DIR, f); const st = fs.statSync(p); return { f, p, t: st.mtimeMs, s: st.size }; })
  .filter(x => x.s > 50000)
  .sort((a, b) => a.t - b.t);

const cand = [];
for (const file of files) {
  let j;
  try { j = JSON.parse(fs.readFileSync(file.p, "utf8")); } catch (e) { continue; }
  if (!j.rows || !j.rows.length) continue;
  const r0 = j.rows[0];
  if (!("c" in r0) || !("q" in r0) || !("pad" in r0)) continue;
  if (!("g" in r0) || !("d" in r0) || !("f" in r0)) continue;   // a channel file, not the sales panel
  cand.push({ f: file.f, ym: r0.ym || null, rows: j.rows.length, truncated: !!j.truncated, t: file.t });
}

/* ---- assign months: explicit ym first, then chronological for the rest ---- */
const noYm = cand.filter(c => !c.ym).sort((a, b) => a.t - b.t);
if (noYm.length > MONTHS.length) {
  console.error("more unlabelled files than months — add 'YYYY-MM' AS ym to the queries");
  process.exit(1);
}
noYm.forEach((c, i) => { c.ym = MONTHS[i]; });

const byMonth = {};
for (const c of cand) {
  if (!MONTHS.includes(c.ym)) continue;
  if (!byMonth[c.ym] || byMonth[c.ym].rows < c.rows) byMonth[c.ym] = c;
}

const missing = MONTHS.filter(m => !byMonth[m]);
if (missing.length) {
  console.error("MISSING MONTHS:", missing.join(", "));
  process.exit(1);
}

/* ---- build the panel ---- */
const panel = [];
const capped = [];
for (const m of MONTHS) {
  const src = byMonth[m];
  if (src.rows >= 500) capped.push(m);
  const j = JSON.parse(fs.readFileSync(path.join(DIR, src.f), "utf8"));
  for (const r of j.rows) {
    panel.push({
      m, c: String(r.c), n: r.n || String(r.c),
      q: +r.q || 0, g: +r.g || 0, v: +r.v || 0, d: +r.d || 0, f: +r.f || 0
    });
  }
}

fs.writeFileSync(path.join(ROOT, "data", "panel_full.json"), JSON.stringify({ months: MONTHS, rows: panel }));

/* ---- report ---- */
const skus = new Set(panel.map(r => r.c));
const pos = new Set(panel.filter(r => r.q > 0 && r.v > 0).map(r => r.c));
console.log("months        ", MONTHS.length, MONTHS[0], "→", MONTHS[MONTHS.length - 1]);
console.log("sku-months    ", panel.length);
console.log("distinct SKUs ", skus.size, "(positive volume:", pos.size + ")");
if (capped.length) console.log("!! months at the 500-row cap, re-pull split by item code:", capped.join(", "));
if (SCOPE.expectedSkus && skus.size !== SCOPE.expectedSkus) {
  console.log("!! RECONCILIATION MISMATCH: ERP says", SCOPE.expectedSkus, "SKUs, panel has", skus.size);
} else if (SCOPE.expectedSkus) {
  console.log("reconciled     OK — matches ERP COUNT(DISTINCT strItemCode)");
}
