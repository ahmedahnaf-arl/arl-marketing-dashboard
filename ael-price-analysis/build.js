/* AEL Price & Elasticity Cockpit v2 — full history Mar-2022 .. Nov-2026 */
const fs = require("fs");
const path = require("path");
const ROOT = __dirname;

const CFG = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, "config.json"), "utf8").replace(/^\uFEFF/, "")); }
  catch (e) { return { buCode: 144, buName: "Akij Essential", buShort: "AEL" }; }
})();

const P = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "panel_full.json"), "utf8").replace(/^\uFEFF/, ""));
const MONTHS = P.months;
const MI = Object.fromEntries(MONTHS.map((m, i) => [m, i]));

/* ---------- declared price snapshot + history ---------- */
let SNAPRAW = [], HIST = [];
try { SNAPRAW = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "snapshot_raw.json"), "utf8").replace(/^\uFEFF/, "")).rows; } catch (e) { }
try { HIST = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "price_history_raw.json"), "utf8").replace(/^\uFEFF/, "")).rows; } catch (e) { }

const SNAP = {};
for (const r of SNAPRAW) {
  const code = r.strItemCode;
  if (!/^\d+$/.test(code)) continue;
  const dte = (r.dteLastActionDateTime || "").slice(0, 10);
  const cur = SNAP[code];
  const better = !cur || (r.isActive && !cur.active) || (!!r.isActive === cur.active && dte > cur.date);
  if (better) SNAP[code] = { dp: r.numDPRate, tp: r.numTPRate, mrp: r.numMrpRate, ch: r.strDistributionChannelName, date: dte, active: !!r.isActive };
}

/* distinct declared price points per code, sorted by effective date */
const HISTBY = {};
for (const h of HIST) {
  const code = h[0];
  if (!/^\d+$/.test(code)) continue;
  (HISTBY[code] = HISTBY[code] || []).push({
    code, name: h[1], ch: h[2], dp: +h[3], tp: +h[4], mrp: +h[5],
    first: (h[6] || "").slice(0, 10), last: (h[7] || "").slice(0, 10), n: +h[8]
  });
}
for (const k of Object.keys(HISTBY)) HISTBY[k].sort((a, b) => a.last < b.last ? -1 : a.last > b.last ? 1 : 0);

/* ---- channel panel (last 24 months), scheme master, booked discounts ---- */
function readJson(p, fb){ try { return JSON.parse(fs.readFileSync(p,"utf8").replace(/^\uFEFF/,"")); } catch(e){ return fb; } }
const CHAN = readJson(path.join(ROOT,"data","channel_full.json"), {months:[],rows:[]});
const OFFH = readJson(path.join(ROOT,"data","offers_header.json"), {rows:[]}).rows;
const SCH  = readJson(path.join(ROOT,"data","schemes.json"), {rows:[]}).rows;
const BOOK = readJson(path.join(ROOT,"data","discount_booked.json"), []);
const CAT = readJson(path.join(ROOT,"data","categories.json"), {map:{},method:{}});
const COMPM = readJson(path.join(ROOT,"data","competitor_market.json"), {rows:[]}).rows;
const COMPB = readJson(path.join(ROOT,"data","competitor_bench.json"), {rows:[]}).rows;
const DELFY = readJson(path.join(ROOT,"data","delivery_fy.json"), {rows:[]}).rows;
const ZONES = readJson(path.join(ROOT,"data","zones.json"), {rows:[]}).rows;
const CHNAMES = {71:"Distributor",70:"Dealer",67:"Bulk",146:"Bulk Flour & Dal",145:"Rice Bulk",72:"Chain Store",68:"Corporate",96:"Export",93:"Government",185:"Tender",69:"Sister Concern",92:"Employee",73:"E-Commerce",183:"HORECA",74:"Trading",0:"Other"};

/* code -> [[channel, qty, value]] over the channel window */
const CHBYCODE = {};
for (const r of CHAN.rows) {
  const a = (CHBYCODE[r.c] = CHBYCODE[r.c] || {});
  const b = (a[r.ch] = a[r.ch] || [0,0]);
  b[0] += r.q; b[1] += r.v;
}
/* month -> [[channel, value, qty]] */
const CHBYMONTH = {};
for (const r of CHAN.rows) {
  const a = (CHBYMONTH[r.m] = CHBYMONTH[r.m] || {});
  const b = (a[r.ch] = a[r.ch] || [0,0]);
  b[0] += r.v; b[1] += r.q;
}
const CHROWS = CHAN.rows.map(r => [MI[r.m], r.ch, r.c, r.q, r.v]);
const CH_TOT = {};
for (const m of Object.keys(CHBYMONTH)) for (const ch of Object.keys(CHBYMONTH[m])) { CH_TOT[ch] = (CH_TOT[ch]||0) + CHBYMONTH[m][ch][0]; }

/* scheme master joined to header */
const OFFHBY = {}; for (const h of OFFH) OFFHBY[h.id] = h;
const SCHEMES = SCH.map(r => {
  const h = OFFHBY[r.id] || {};
  return { id:r.id, code:r.oc, item:r.onm||h.item||"", ch:+h.ch||0, chn:h.chn||CHNAMES[h.ch]||"", slabs:+r.slabs,
    bf:+r.bf, bt:+r.bt, qmin:+r.qmin, qmax:+r.qmax, pmin:+r.pmin, pmax:+r.pmax, amin:+r.amin, amax:+r.amax,
    f:h.f, l:h.l, act:!!h.act, typ:h.typ||"" };
});

/* ---- distributor/dealer channel price grid (itm.tblPriceSetup) ---- */
const PS = {};
for (const f of ["price_setup_raw_1.json","price_setup_raw_2.json"]) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(ROOT,"data",f),"utf8").replace(/^\uFEFF/, ""));
    for (const r of raw.rows) {
      (PS[r.c] = PS[r.c] || []).push({ ch: +r.ch, pr: +r.pr, from: r.f, to: r.l });
    }
  } catch (e) { console.warn("price grid missing:", f, e.message); }
}
for (const k of Object.keys(PS)) PS[k].sort((a,b)=> a.from < b.from ? -1 : 1);

/* channel 71 = Distributor (DP) · channel 70 = Dealer (TP) */
function gridAt(code, ch, ym) {
  const arr = PS[code]; if (!arr) return null;
  const lo = ym + "-01", hi = ym + "-31";
  let out = null;
  for (const p of arr) { if (p.ch !== ch) continue; if (p.from <= hi && p.to >= lo) { if (!out || p.from > out.from) out = p; } }
  return out;
}

/* resolved declared price for a SKU-month: channel grid first, retail log second */
function priceAt(code, ym) {
  const rl = HISTBY[code] ? declaredAt(code, ym) : null;
  const dpP = gridAt(code, 71, ym), tpP = gridAt(code, 70, ym);
  const dp = dpP ? dpP.pr : (rl ? rl.dp : null);
  const tp = tpP ? tpP.pr : (rl ? rl.tp : null);
  const mrp = rl ? rl.mrp : (SNAP[code] ? SNAP[code].mrp : null);
  const src = (dpP || tpP) ? ((rl || SNAP[code]) ? "grid+mrp" : "grid") : (rl ? "retail" : "");
  return { dp, tp, mrp, src };
}

/* most recent declared point, regardless of sales month */
function latestDecl(code) {
  const arr = PS[code] || [];
  const pick = ch => { let o=null; for (const p of arr) { if (p.ch===ch && (!o || p.to >= o.to)) o=p; } return o; };
  const d = pick(71), t = pick(70);
  const pts = HISTBY[code] || [];
  const r = pts.length ? pts[pts.length-1] : null;
  const snapR = SNAP[code] || null;
  return {
    dp: d ? d.pr : (r ? r.dp : null),
    tp: t ? t.pr : (r ? r.tp : null),
    mrp: r ? r.mrp : (snapR ? snapR.mrp : null),
    dpDate: d ? d.to : (t ? t.to : (r ? r.last : null)),
    src: (d || t) ? ((r || snapR) ? "grid+mrp" : "grid") : (r ? "retail" : "")
  };
}
/* declared price in force at month-end */
function declaredAt(code, ym) {
  const pts = HISTBY[code]; if (!pts || !pts.length) return null;
  const end = ym + "-31";
  let out = null;
  for (const p of pts) { if (p.last && p.last <= end) out = p; else break; }
  return out;
}

/* ---------- build series ---------- */
const series = {};          // code -> array[57]
const names = {};
for (const r of P.rows) {
  const i = MI[r.m];
  if (i === undefined) continue;
  (series[r.c] = series[r.c] || new Array(MONTHS.length).fill(null))[i] = { q: r.q, g: r.g, v: r.v, d: r.d, f: r.f, p: r.q > 0 && r.v > 0 ? r.v / r.q : null };
  if (r.n) names[r.c] = r.n;
}

function unitOf(name) {
  if (/1000\s*kg|1000kg/i.test(name)) return "MT";
  const m = name.match(/(\d+(?:\.\d+)?)\s*(kg|Kg|KG)/);
  if (m && +m[1] >= 5) return "Bag";
  if (/tin|liter|litre|\bml\b/i.test(name)) return "Tin/L";
  return "Pcs";
}

const num = (v, d = 0) => (v == null || !isFinite(v)) ? "—" : Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (v, d = 1) => (v == null || !isFinite(v)) ? "—" : (v * 100).toFixed(d) + "%";
const cr = v => (v == null ? "—" : (v / 1e7).toFixed(2));
const bdtCr = v => (v == null ? "—" : (v / 1e7).toLocaleString("en-US", { maximumFractionDigits: 1 }));

function ols(pts) {
  const n = pts.length; if (n < 3) return null;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (const p of pts) { sx += p.x; sy += p.y; sxx += p.x * p.x; syy += p.y * p.y; sxy += p.x * p.y; }
  const den = n * sxx - sx * sx; if (Math.abs(den) < 1e-12) return null;
  const b = (n * sxy - sx * sy) / den, a = (sy - b * sx) / n;
  let ssr = 0, sst = 0; const my = sy / n;
  for (const p of pts) { const pr = a + b * p.x; ssr += (p.y - pr) ** 2; sst += (p.y - my) ** 2; }
  return { b, a, r2: sst > 0 ? 1 - ssr / sst : 0, n, sdx: Math.sqrt(Math.max(0, sxx / n - (sx / n) ** 2)) };
}

function cmpKeyOf(name){
  const n = (name||"").toLowerCase().replace(/\s+/g," ");
  const has = re => re.test(n);
  const sz = (re) => re.test(n);
  if (has(/atta/)) { if(sz(/\b1 ?kg\b/))return "Atta 1kg"; if(sz(/\b2 ?kg\b/))return "Atta 2kg"; if(sz(/\b5 ?kg\b/))return "Atta 5kg"; if(sz(/\b50 ?kg\b/))return "Atta 50 KG"; }
  if (has(/maida/)) { if(sz(/\b1 ?kg\b/))return "Maida 1kg"; if(sz(/\b2 ?kg\b/))return "Maida 2kg"; if(sz(/\b5 ?kg\b/))return "Maida 5kg"; if(sz(/\b50 ?kg\b/))return "Maida 50 KG"; }
  if (has(/suji|semolina/)) { if(sz(/200 ?g/))return "Semolina 200gm"; if(sz(/250 ?g/))return "Semolina 250gm"; if(sz(/500 ?g/))return "Semolina 500gm"; }
  if (has(/chinigura/) && !has(/khud/)) { if(sz(/\b1 ?kg\b/))return "Chinigura 1kg"; if(sz(/\b2 ?kg\b/))return "Chinigura 2kg"; if(sz(/\b5 ?kg\b/))return "Chinigura 5kg"; if(sz(/\b50 ?kg\b/))return "Chinigura 50 KG"; }
  if (has(/miniket/) && !has(/tender|rm-/)) { if(sz(/\b5 ?kg\b/))return "Miniket 5kg"; if(sz(/\b10 ?kg\b/))return "Miniket 10kg"; if(sz(/\b50 ?kg\b/))return "Miniket 50 KG"; }
  if (has(/najirshail|nazirshail/)) { if(sz(/\b5 ?kg\b/))return "Nazirshail 5kg"; if(sz(/\b10 ?kg\b/))return "Nazirshail 10kg"; }
  if (has(/katari najir/)) { if(sz(/\b5 ?kg\b/))return "Katari Nazir 5kg"; if(sz(/\b10 ?kg\b/))return "Katari Nazir 10kg"; }
  if (has(/banglamoti|bashmoti/) && !has(/deshi|chita/)) { if(sz(/\b5 ?kg\b/))return "Banglamoti 5kg"; if(sz(/\b10 ?kg\b/))return "Banglamoti 10kg"; }
  if (has(/salt/)) { if(sz(/500 ?g/))return "Salt 500gm"; if(sz(/\b1 ?kg\b/))return "Salt 1kg"; }
  if (has(/sugar/)) { if(sz(/500 ?g/))return "Sugar 500gm"; if(sz(/\b1 ?kg\b/))return "Sugar 1kg"; }
  if (has(/soybean|soya/)) { if(sz(/250 ?ml/))return "Soybean 250ml"; if(sz(/500 ?ml/))return "Soybean 500ml"; if(sz(/1000 ?ml|1 ?l/))return "Soybean 1ltr"; if(sz(/\b2 ?l/))return "Soybean 2ltr"; if(sz(/\b3 ?l/))return "Soybean 3ltr"; if(sz(/\b5 ?l/))return "Soybean 5ltr"; }
  return null;
}
const ROWS = [];
for (const code of Object.keys(series)) {
  const s = series[code];
  const obs = [];
  for (let i = 0; i < s.length; i++) if (s[i] && s[i].q > 0 && s[i].p) obs.push({ i, ...s[i] });
  if (!obs.length) continue;

  let totalQ = 0, totalV = 0, totalD = 0, totalF = 0;
  for (const o of obs) { totalQ += o.q; totalV += o.v; totalD += o.d; totalF += o.f; }

  /* drop months whose unit price is >5x or <1/5 of the SKU median (UOM / pack breaks) */
  const lps = obs.map(o => Math.log(o.p)).sort((a, b) => a - b);
  const medLp = lps[Math.floor(lps.length / 2)];
  const keep = obs.filter(o => Math.abs(Math.log(o.p) - medLp) <= Math.log(5));
  const uomBreak = keep.length !== obs.length ? obs.length - keep.length : 0;
  const use = keep.length >= 2 ? keep : obs;

  const first = use[0], last = use[use.length - 1];
  const priceChg = (first.p && last.p) ? last.p / first.p - 1 : null;

  let moves = 0, up = 0, down = 0, maxJump = null;
  let prev = null;
  for (const o of use) {
    if (prev && prev.p) {
      const ch = o.p / prev.p - 1;
      if (Math.abs(ch) >= 0.02) moves++;
      if (ch > 0) up++; else if (ch < 0) down++;
      if (!maxJump || Math.abs(ch) > Math.abs(maxJump.ch)) maxJump = { ch, m: MONTHS[o.i], from: prev.p, to: o.p };
    }
    prev = o;
  }
  let prevQ = null; let lastVolChg = null;
  for (const o of use) { if (prevQ) lastVolChg = o.q / prevQ - 1; prevQ = o.q; }
  /* MoM summary uses the last COMPLETE month (the final month may be partial) */
  const lf = MONTHS.length - 2;
  let lu = null, lpre = null;
  for (const o of use) { if (o.i <= lf) { lpre = lu; lu = o; } }
  const lastPriceChg = (lpre && lpre.p && lu) ? lu.p / lpre.p - 1 : null;
  const lastVolChg2 = (lpre && lu) ? lu.q / lpre.q - 1 : null;

  let el = null, elOk = false, elLvl = null;
  if (use.length >= 18) {
    const L = ols(use.map(o => ({ x: Math.log(o.p), y: Math.log(o.q) })));
    if (L && isFinite(L.b)) elLvl = { b: L.b, r2: L.r2, n: L.n };
    const diffs = [];
    for (let k = 1; k < use.length; k++) {
      if (use[k].i === use[k - 1].i + 1) {
        const dx = Math.log(use[k].p / use[k - 1].p);
        const dy = Math.log(use[k].q / use[k - 1].q);
        if (isFinite(dx) && isFinite(dy)) diffs.push({ x: dx, y: dy });
      }
    }
    const D = ols(diffs);
    if (D && diffs.length >= 15 && isFinite(D.b)) {
      el = { b: D.b, r2: D.r2, n: diffs.length, sdx: D.sdx };
      elOk = (D.sdx >= 0.02 && Math.abs(D.b) <= 8);
    }
  }

  const lastDecl = latestDecl(code);
  const dpMonths = MONTHS.filter(m => { const d = priceAt(code, m); return d.dp != null; }).length;
  const tpMonths = MONTHS.filter(m => { const d = priceAt(code, m); return d.tp != null; }).length;
  const mrpMonths = MONTHS.filter(m => { const d = priceAt(code, m); return d.mrp != null; }).length;
  const snap = { dp: lastDecl.dp, tp: lastDecl.tp, mrp: lastDecl.mrp };
  const mrpReal = (snap.mrp && last.p) ? last.p / snap.mrp : null;
  const unitSuspect = !!(snap.mrp && mrpReal != null && (mrpReal < 0.35 || mrpReal > 1.6));

  ROWS.push({
    code, name: names[code] || code, unit: unitOf(names[code] || ""),
    totalQ, totalV, totalD, totalF,
    months: obs.length, uomBreak,
    firstMonth: MONTHS[first.i], lastMonth: MONTHS[last.i],
    firstPrice: first.p, lastPrice: last.p, priceChg,
    lastPriceChg, lastVolChg: lastVolChg2,
    moves, up, down, maxJump,
    el: el ? { b: el.b, r2: el.r2, n: el.n, sdx: el.sdx } : null, elOk, elL: elLvl,
    cat: CAT.map[code] || null, ck: cmpKeyOf(names[code] || code),
    dp: snap ? snap.dp : null, tp: snap ? snap.tp : null, mrp: snap ? snap.mrp : null,
    dpDate: lastDecl.dpDate, mrpReal, unitSuspect, dpMonths, tpMonths, mrpMonths, declSrc: lastDecl.src
  });
}
ROWS.sort((a, b) => b.totalV - a.totalV);

/* ---------- portfolio ---------- */
const PORT = MONTHS.map((m, i) => {
  let v = 0, q = 0, d = 0, f = 0, n = 0;
  for (const c of Object.keys(series)) {
    const s = series[c][i];
    if (s && s.q > 0) { v += s.v; q += s.q; d += s.d; f += s.f; n++; }
  }
  return { m, v, q, d, f, n };
});

/* breadth: share of SKUs whose realized price rose / fell vs prior month with sales */
const BREADTH = MONTHS.map((m, i) => {
  let up = 0, dn = 0, fl = 0;
  for (const c of Object.keys(series)) {
    const s = series[c];
    if (!s[i] || !s[i].p) continue;
    let j = i - 1; while (j >= 0 && (!s[j] || !s[j].p)) j--;
    if (j < 0) continue;
    const ch = s[i].p / s[j].p - 1;
    if (ch > 0.005) up++; else if (ch < -0.005) dn++; else fl++;
  }
  return { m, up, dn, fl, n: up + dn + fl };
});

const TOTAL_V = PORT.reduce((a, b) => a + b.v, 0);
const SKU_COUNT = ROWS.length;
const ACTIVE_LAST = PORT[PORT.length - 2].n;
const LAST_FULL = MONTHS[MONTHS.length - 2];
const EL = ROWS.filter(r => r.elOk);
const MED_EL = EL.length ? [...EL].map(r => r.el.b).sort((a, b) => a - b)[Math.floor(EL.length / 2)] : null;
const DECL = ROWS.filter(r => r.dp != null);
const DECLARED = ROWS.filter(r => r.dp != null || r.tp != null || r.mrp != null).length;
const PRICE_UP = BREADTH.filter(b => b.n > 0).reduce((a, b) => a + b.up, 0);
const PRICE_DN = BREADTH.filter(b => b.n > 0).reduce((a, b) => a + b.dn, 0);

/* ---------- CSV: every SKU x every month ---------- */
const csv = ["ItemCode,ItemName,Month,Qty,NetValue,RealizedPrice,MoMPricePct,MoMVolumePct,DiscountValue,FreeQty,DeclaredDP,DeclaredTP,DeclaredMRP"];
for (const r of ROWS) {
  const s = series[r.code];
  let prev = null;
  for (let i = 0; i < MONTHS.length; i++) {
    const x = s[i];
    if (!x || !(x.q > 0)) continue;
    const mp = (prev && prev.p && x.p) ? (x.p / prev.p - 1) * 100 : "";
    const mv = (prev && prev.q) ? (x.q / prev.q - 1) * 100 : "";
    const d = priceAt(r.code, MONTHS[i]);
    csv.push([
      r.code, '"' + (r.name || "").replace(/"/g, '""') + '"', MONTHS[i],
      x.q, x.v.toFixed(2), x.p ? x.p.toFixed(4) : "",
      typeof mp === "number" ? mp.toFixed(2) : "", typeof mv === "number" ? mv.toFixed(2) : "",
      x.d || 0, x.f || 0,
      d ? d.dp : "", d ? d.tp : "", d ? d.mrp : ""
    ].join(","));
    prev = x;
  }
}
fs.writeFileSync(path.join(ROOT, "AEL_SKU_Monthly_Panel_FullHistory.csv"), csv.join("\n"));

/* ---------- payload for the page ---------- */
const PAY = {
  months: MONTHS,
  port: PORT,
  breadth: BREADTH,
  rows: ROWS.map(r => ({
    c: r.code, n: r.name, u: r.unit, v: Math.round(r.totalV), q: Math.round(r.totalQ),
    mo: r.months, fm: r.firstMonth, lm: r.lastMonth,
    p0: r.firstPrice, p1: r.lastPrice, pc: r.priceChg,
    lpc: r.lastPriceChg, lvc: r.lastVolChg,
    mv: r.moves, up: r.up, dn: r.down,
    mj: r.maxJump ? { ch: r.maxJump.ch, m: r.maxJump.m, f: r.maxJump.from, t: r.maxJump.to } : null,
    el: r.el, eok: r.elOk, elL: r.elL,
    cat: r.cat, ck: r.ck,
    dp: r.dp, tp: r.tp, mrp: r.mrp, mr: r.mrpReal, us: r.unitSuspect, ub: r.uomBreak, dm: r.dpMonths, tm: r.tpMonths, mm: r.mrpMonths, dd: r.dpDate
  })),
  series: Object.fromEntries(ROWS.map(r => {
    const s = series[r.code];
    return [r.code, s.map(x => x && x.q > 0 ? [Math.round(x.q), Math.round(x.v), Math.round(x.d || 0), Math.round(x.f || 0)] : 0)];
  })),
  decl: ROWS.filter(r => HISTBY[r.code]).map(r => ({ c: r.code, n: r.name, pts: HISTBY[r.code] })),
  ps: Object.fromEntries(Object.keys(PS).map(c => [c, PS[c]])),
  chNames: CHNAMES,
  chByCode: CHBYCODE,
  chRows: CHROWS,
  chByMonth: CHBYMONTH,
  chTot: CH_TOT,
  chMonths: CHAN.months,
  schemes: SCHEMES,
  cats: CAT.map,
  catMethod: CAT.method,
  catCounts: (()=>{const c={}; for(const r of ROWS){const v=r.cat||"Unmapped"; c[v]=(c[v]||0)+1;} return c;})(),
  compMarket: COMPM,
  compBench: COMPB,
  delFy: DELFY,
  zones: ZONES,
  compMonths: [...new Set(COMPM.map(r=>r.ym))].sort(),
  booked: BOOK,
  snapshotSold: DECL.length
};

const page = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="robots" content="noindex,nofollow"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${CFG.buShort} Price &amp; Volume History Cockpit</title>
<style>
:root{--bg:#0b1016;--panel:#111823;--panel2:#16202e;--line:#22303f;--txt:#e6edf5;--muted:#8b9bb0;--amber:#f5a524;--teal:#2dd4bf;--red:#f26d6d;--green:#4ade80;--blue:#60a5fa}
*{box-sizing:border-box}
body{margin:0;background:linear-gradient(180deg,#0b1016,#0d1520 60%);color:var(--txt);font:14px/1.45 "Segoe UI",Inter,system-ui,sans-serif}
header{padding:20px 26px 12px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:flex-end;gap:18px;flex-wrap:wrap}
h1{margin:0;font-size:19px;letter-spacing:.2px}h1 span{color:var(--amber)}
.sub{color:var(--muted);font-size:12px;margin-top:4px}
.badge{background:rgba(245,165,36,.12);border:1px solid rgba(245,165,36,.45);color:var(--amber);padding:5px 10px;border-radius:999px;font-size:11px;letter-spacing:.4px;white-space:nowrap}
nav{display:flex;gap:2px;padding:10px 26px 0;flex-wrap:wrap;border-bottom:1px solid var(--line)}
nav button{background:transparent;border:0;border-bottom:2px solid transparent;color:var(--muted);padding:9px 12px;cursor:pointer;font-size:12.5px}
nav button:hover{color:var(--txt)}nav button.on{color:var(--amber);border-bottom-color:var(--amber)}
main{padding:18px 26px 60px}section{display:none}section.on{display:block}
.grid{display:grid;gap:12px}.g5{grid-template-columns:repeat(5,1fr)}.g4{grid-template-columns:repeat(4,1fr)}.g2{grid-template-columns:repeat(2,1fr)}
@media(max-width:1250px){.g5{grid-template-columns:repeat(2,1fr)}.g4{grid-template-columns:repeat(2,1fr)}.g2{grid-template-columns:1fr}}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.kpi .lab{color:var(--muted);font-size:10.5px;text-transform:uppercase;letter-spacing:.7px}
.kpi .val{font-size:22px;font-weight:600;margin-top:5px}
.kpi .note{color:var(--muted);font-size:11px;margin-top:4px}
.card h3{margin:0 0 3px;font-size:13.5px;font-weight:600}
.card .hint{color:var(--muted);font-size:11.5px;margin-bottom:10px}
table{width:100%;border-collapse:collapse;font-size:12.2px}
th{position:sticky;top:0;background:var(--panel2);color:var(--muted);font-weight:600;text-align:right;padding:7px 8px;border-bottom:1px solid var(--line);font-size:10.5px;text-transform:uppercase;letter-spacing:.45px;cursor:pointer;white-space:nowrap;z-index:2}
th:first-child,td:first-child{text-align:left}
td{padding:6px 8px;border-bottom:1px solid rgba(34,48,63,.6);text-align:right;white-space:nowrap}
tr:hover td{background:rgba(96,165,250,.06)}
.tag{display:inline-block;padding:2px 6px;border-radius:6px;font-size:10.3px;border:1px solid}
.t-neg{color:var(--green);border-color:rgba(74,222,128,.35);background:rgba(74,222,128,.08)}
.t-pos{color:var(--red);border-color:rgba(242,109,109,.35);background:rgba(242,109,109,.08)}
.t-mut{color:var(--muted);border-color:var(--line);background:rgba(139,155,176,.07)}
.pos{color:var(--green)}.neg{color:var(--red)}
.scroll{max-height:600px;overflow:auto;border-radius:10px;border:1px solid var(--line)}
.toolbar{display:flex;gap:9px;align-items:center;margin-bottom:9px;flex-wrap:wrap}
input[type=search],select{background:var(--panel2);border:1px solid var(--line);color:var(--txt);padding:6px 9px;border-radius:8px;font-size:12.5px;min-width:200px}
.guide{background:linear-gradient(180deg,rgba(96,165,250,.08),rgba(96,165,250,.03));border:1px solid rgba(96,165,250,.22);border-radius:11px;padding:12px 15px;margin-bottom:13px;display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
@media(max-width:1000px){.guide{grid-template-columns:1fr}}
.guide .gl{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:var(--amber);margin-bottom:4px;font-weight:600}
.guide p{margin:0;font-size:11.8px;color:#c3d1e2;line-height:1.55}
.smart{display:flex;flex-direction:column;gap:7px}
.smart>div{display:grid;grid-template-columns:22px 1fr;gap:9px;align-items:start}
.sk{width:20px;height:20px;border-radius:6px;background:rgba(245,165,36,.15);border:1px solid rgba(245,165,36,.45);color:var(--amber);font-size:10.5px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:1px}
.smart p{margin:0;font-size:12px;color:#c3d1e2;line-height:1.5}
.tip{position:fixed;pointer-events:none;background:#0d1622;border:1px solid #33465c;border-radius:8px;padding:8px 10px;font-size:11.5px;color:#e6edf5;box-shadow:0 8px 24px rgba(0,0,0,.5);z-index:99;opacity:0;transition:opacity .12s;max-width:280px}
.tip b{color:#f5a524}
.chipbar{display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap}
.chip{border:1px solid var(--line);background:var(--panel2);padding:5px 10px;border-radius:999px;font-size:11.5px;color:var(--muted);cursor:pointer;user-select:none}
.chip.on{color:var(--amber);border-color:rgba(245,165,36,.55);background:rgba(245,165,36,.12)}
.chip:hover{border-color:#3a4a5e}
.mchip{background:rgba(245,165,36,.12);border:1px solid rgba(245,165,36,.4);color:#f5a524;border-radius:999px;padding:4px 10px;font-size:11px;cursor:pointer}
.note-box{background:rgba(96,165,250,.06);border:1px solid rgba(96,165,250,.25);border-radius:10px;padding:11px 13px;color:#c9d7ea;font-size:12.2px}
.warn{background:rgba(245,165,36,.06);border-color:rgba(245,165,36,.28)}
.legend{display:flex;gap:14px;color:var(--muted);font-size:11.2px;margin-top:6px;flex-wrap:wrap}
.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px}
.small{font-size:11.2px;color:var(--muted)}
footer{padding:14px 26px;border-top:1px solid var(--line);color:var(--muted);font-size:11.2px}
</style></head><body>
<header>
  <div><h1>${CFG.buName} (${CFG.buShort}) — <span>Price &amp; Volume History Cockpit</span></h1>
  <div class="sub">Every SKU sold since inception · ${MONTHS[0]} → ${MONTHS[MONTHS.length-1]} (${MONTHS.length} months) · DP / TP / MRP, realized price, volume and MoM change · iBOS ERP, BU ${CFG.buCode}</div></div>
  <div class="badge">${SKU_COUNT.toLocaleString()} SKUs · LIVE ERP EXTRACT</div>
</header>
<nav>
  <button class="on" data-t="ov">Overview</button>
  <button data-t="sku">All SKUs</button>
  <button data-t="mom">SKU month-on-month</button>
  <button data-t="chg">Price change tracker</button>
  <button data-t="inc">Incentives &amp; schemes</button>
  <button data-t="pg">Declared price grid</button>
  <button data-t="cmp">Competition</button>
  <button data-t="dec">Decision · Direction · Action</button>
  <button data-t="el">Elasticity</button>
  <button data-t="mt">Method &amp; coverage</button>
</nav>
<main>
<div class="chipbar" id="globalbar" style="border-bottom:1px solid var(--line);padding-bottom:9px">
  <span class="small" style="margin-right:4px">Period:</span>
  <select id="dFrom" style="min-width:110px"></select><span class="small">to</span><select id="dTo" style="min-width:110px"></select>
  <span class="chip" data-range="12">Last 12M</span><span class="chip" data-range="24">Last 24M</span><span class="chip" data-range="all">All</span>
  <span class="chip" id="dReset">Reset filters</span>
  <span class="small" id="rangeNote" style="margin-left:6px"></span>
</div>
<div class="chipbar" id="chbar"><span class="small" style="margin-right:6px">Channel:</span></div>
<div class="chipbar" id="catbar"><span class="small" style="margin-right:6px">Category:</span></div>

<section id="ov" class="on">
  <div class="guide"><div><div class="gl">What this answers</div><p>How large is AEL's book, when did it expand or contract, and are prices drifting up or down across the portfolio?</p></div><div><div class="gl">How to read it</div><p>Bars are monthly net revenue (BDT Cr); the teal line is how many SKUs sold that month. The breadth chart shows the share of SKUs whose price rose (red) versus fell (teal) against their previous selling month. Hover any bar for detail; click it to filter the SKU table.</p></div><div><div class="gl">Source &amp; filters</div><p>Every sales-order row for BU 144, Mar-2022 to Nov-2026. Use the channel chips above to slice the SKU table and channel mix (last 24 months); portfolio KPIs stay all-channel.</p></div></div>
  <div class="grid g5">
    <div class="card kpi"><div class="lab">Net revenue since inception</div><div class="val" id="k1"></div><div class="note" id="k1n"></div></div>
    <div class="card kpi"><div class="lab">SKUs sold</div><div class="val" id="k2"></div><div class="note">in the selected window</div></div>
    <div class="card kpi"><div class="lab">Active last month</div><div class="val" id="k3"></div><div class="note" id="k3n"></div></div>
    <div class="card kpi"><div class="lab">Declared-price SKUs</div><div class="val" id="k4"></div><div class="note">DP / TP / MRP configured</div></div>
    <div class="card kpi"><div class="lab">Median elasticity</div><div class="val" id="k5"></div><div class="note" id="k5n"></div></div>
  </div>
  <div class="grid g2" style="margin-top:12px">
    <div class="card"><h3>Monthly revenue (৳ Cr) and active SKUs</h3><div class="hint">Bars = net revenue. Line = number of SKUs that sold that month.</div><div id="cPort"></div></div>
    <div class="card"><h3>Price direction breadth</h3><div class="hint">Share of SKUs whose realized price rose (red) vs fell (teal) against the previous month with sales.</div><div id="cBreadth"></div></div>
  </div>
  <div class="grid g2" style="margin-top:12px">
    <div class="card"><h3>What this view says</h3><div id="noteOv" class="note-box" style="font-size:12.4px;line-height:1.6"></div></div>
    <div class="card"><h3>Channel mix</h3><div class="hint">Net revenue by channel, last 24 months. Click a bar to filter the SKU table.</div><div id="cChan"></div></div></div>
  <div class="card" style="margin-top:12px"><h3>Top 12 SKUs — price journey</h3><div class="hint">First realized price → latest, with % change</div><div id="cJourney"></div></div>
  </div>
</section>

<section id="sku">
  <div class="guide"><div><div class="gl">What this answers</div><p>Which SKUs moved price most over their life, which are price-sensitive, and which carry a declared DP / TP / MRP?</p></div><div><div class="gl">How to read it</div><p>One row per SKU. Change-since-first compares the first and last realized price. MoM price and volume compare the last two months the SKU actually sold. Select channels in the bar above to see that channel\u2019s revenue and volume (last 24 months); leave it on “All channels” for lifetime totals.</p></div><div><div class="gl">Source</div><p>Realized price = net value divided by quantity, per month. Declared prices come from the channel price grid and the retail price table.</p></div></div>
  <div class="card">
    <h3>Every SKU — price and volume summary</h3>
    <div class="hint">All ${SKU_COUNT} SKUs that sold since ${MONTHS[0]}. Click a row for the full month-on-month series. *MoM compares the SKU\u2019s last two active months, so for dormant SKUs it reflects the month they stopped selling.</div>
    <div class="toolbar">
      <input id="q" type="search" placeholder="Search code or name…"/>
      <select id="fEl"><option value="">All elasticity</option><option value="neg">Elastic (&lt; −1)</option><option value="pos">Anomalous (&gt; 0)</option><option value="na">Not measurable</option></select>
      <select id="fDecl"><option value="">All SKUs</option><option value="y">Declared price only</option></select>
      <select id="fMove"><option value="">Any price history</option><option value="r3">Price moved in last 3 months</option><option value="big">Largest move &gt; 20%</option></select>
      <span class="small" id="rc"></span>
    </div>
    <div id="mfbar" class="chipbar"></div>
    <div class="scroll"><table id="tSku"><thead><tr>
      <th data-s="n">SKU</th><th data-s="u">Unit</th><th data-s="mo">Months</th><th data-s="v">Net revenue</th><th data-s="q">Volume</th>
      <th data-s="p0">First price</th><th data-s="p1">Last price</th><th data-s="pc">Change since first</th>
      <th data-s="lm">Last sale</th><th data-s="lpc">MoM price*</th><th data-s="lvc">MoM vol*</th><th data-s="mv">Price moves</th><th data-s="el">Elasticity</th>
    </tr></thead><tbody></tbody></table></div>
  </div>
</section>

<section id="mom">
  <div class="guide"><div><div class="gl">What this answers</div><p>What did one SKU charge and sell, month by month, and where were the price and volume breaks?</p></div><div><div class="gl">How to read it</div><p>Price % and volume % compare with the previous month that had sales. The right axis is realized price, the left is volume. Declared DP / TP / MRP for that month appear where the ERP holds them.</p></div><div><div class="gl">Source</div><p>Monthly sales rows plus the declared grid in force at each month-end. Pick any SKU and date range above.</p></div></div>
  <div class="card">
    <h3 id="momTitle">Month-on-month series</h3>
    <div class="hint">Volume, realized price and both month-on-month changes, with declared DP / TP / MRP where configured.</div>
    <div class="toolbar"><select id="momPick" style="min-width:360px"></select>
      <select id="momRange"><option value="all">Full history</option><option value="24">Last 24 months</option><option value="12">Last 12 months</option></select>
    </div>
    <div id="momChart"></div>
    <div class="note-box" id="momNote" style="margin-top:10px"></div>
    <div class="scroll" style="margin-top:12px"><table id="tMom"><thead><tr>
      <th>Month</th><th>Volume</th><th>Net revenue</th><th>Realized price</th><th>MoM price</th><th>MoM volume</th>
      <th>Discount</th><th>Free qty</th><th>DP</th><th>TP</th><th>MRP</th><th>Realized / MRP</th>
    </tr></thead><tbody></tbody></table></div>
  </div>
</section>

<section id="chg">
  <div class="guide"><div><div class="gl">What this answers</div><p>When exactly did declared prices move, and which realized prices jumped the most?</p></div><div><div class="gl">How to read it</div><p>Left table lists every distinct declared DP / TP / MRP point and the dates it was in force. Right table lists the largest month-on-month realized price moves with the volume reaction in the same month.</p></div><div><div class="gl">Source</div><p>rtm retail-price log and the itm channel price grid. Click a SKU to open its monthly history.</p></div></div>
  <div class="grid g2">
    <div class="card"><h3>Declared price changes (DP / TP / MRP)</h3><div class="hint">Every distinct declared price point in the retail-price log.</div>
      <div class="toolbar"><input id="chq" type="search" placeholder="Filter SKU…"/><span class="small" id="chc"></span></div>
      <div class="scroll" style="max-height:520px"><table id="tChg"><thead><tr><th>SKU</th><th>Channel</th><th>DP</th><th>TP</th><th>MRP</th><th>First</th><th>Last</th></tr></thead><tbody></tbody></table></div>
    </div>
    <div class="card"><h3>Largest realized price moves</h3><div class="hint">Biggest month-on-month realized price jumps and the volume response in the same month.</div>
      <div class="scroll" style="max-height:520px"><table id="tJump"><thead><tr><th>SKU</th><th>Month</th><th>From</th><th>To</th><th>Price Δ</th><th>Volume Δ</th></tr></thead><tbody></tbody></table></div>
    </div>
  </div>
</section>

<section id="el">
  <div class="note-box" id="elNote" style="margin-bottom:12px"></div>
  <div class="guide"><div><div class="gl">What this answers</div><p>If we move price by 1%, how much does volume move, and is a price cut revenue-positive?</p></div><div><div class="gl">How to read it</div><p>Below -1 means volume responds more than price, so a cut can grow revenue. Between -1 and 0 volume barely reacts. Positive values usually mean import cost is driving both price and volume, not pricing power. R-squared shows how much of the movement price explains; Level beta is the cross-check.</p></div><div><div class="gl">Source</div><p>First-difference regression of monthly ln(volume) on ln(realized price) per SKU, needing 8 or more month-to-month pairs and a fit of R² 0.10+ to be ranked.</p></div></div>
  <div class="grid g4">
    <div class="card kpi"><div class="lab">Measurable SKUs</div><div class="val" id="e1"></div><div class="note">18+ months, real price variation</div></div>
    <div class="card kpi"><div class="lab">Elastic (&lt; −1)</div><div class="val" id="e2"></div><div class="note">volume responds more than price</div></div>
    <div class="card kpi"><div class="lab">Inelastic (−1…0)</div><div class="val" id="e3"></div><div class="note">volume sticky to price</div></div>
    <div class="card kpi"><div class="lab">Anomalous (&gt; 0)</div><div class="val" id="e4"></div><div class="note">cost pass-through / supply driven</div></div>
  </div>
  <div class="grid g2" style="margin-top:12px">
    <div class="card"><h3>Elasticity by SKU</h3><div class="hint">First-difference elasticity (ΔlnQ on ΔlnP). Click a bar to inspect that SKU.</div><div id="cEl"></div></div>
    <div class="card"><h3 id="elTitle">Select a SKU</h3><div class="hint">Month-to-month change in log price vs log volume, with the fitted slope.</div><div class="note-box" id="elComment" style="margin-bottom:8px"></div><div id="cElDetail" style="min-height:240px"></div></div>
  </div>
  <div class="card" style="margin-top:12px"><h3>Elasticity table</h3>
    <div class="scroll"><table id="tEl"><thead><tr><th>SKU</th><th>Pairs</th><th>β</th><th>R²</th><th>Read</th></tr></thead><tbody></tbody></table></div></div>
  <div class="card" style="margin-top:12px"><div class="note-box"><b>How to read it.</b> β is the % change in volume per 1% change in price, estimated from month-to-month movements so the shared cost trend cancels out. −2.0 means a 10% price cut moves volume 20%; revenue rises only when |β| > 1. Click a bar or a row to see the SKU&rsquo;s own data and a plain-language read. Commodity codes often print positive values because import cost drives both price and volume.</div></div>
</section>

<section id="inc">
  <div class="guide">
    <div><div class="gl">What this answers</div><p>What trade schemes and discounts has AEL actually set up and booked, on which SKUs and channels, and how much free product went out?</p></div>
    <div><div class="gl">How to read it</div><p>The scheme table is the <b>planned</b> offer master: the slab a buyer must cross and what they get (free quantity, percent or amount). The booked table is what was <b>actually deducted on orders</b>. Free-goods volume is the incentive that never shows up in DP / TP / MRP.</p></div>
    <div><div class="gl">Source</div><p>rtm.tblRTMTradeOfferSetupHeader / Row (scheme master from Dec-2025), oms.tblSalesOrderRowDiscount (booked item discounts, from 10-Oct-2026) and the free-goods flag on sales-order rows.</p></div>
  </div>
  <div class="grid g4">
    <div class="card kpi"><div class="lab">Trade schemes</div><div class="val" id="n1"></div><div class="note">in the scheme master</div></div>
    <div class="card kpi"><div class="lab">Active schemes</div><div class="val" id="n2"></div><div class="note">live at last refresh</div></div>
    <div class="card kpi"><div class="lab">Booked item discounts</div><div class="val" id="n3"></div><div class="note">Oct–Nov 2026 only</div></div>
    <div class="card kpi"><div class="lab">Free-goods volume</div><div class="val" id="n4"></div><div class="note" id="n4n">all SKUs in view</div></div>
  </div>
  <div class="grid g2" style="margin-top:12px">
    <div class="card"><h3>Scheme coverage by channel</h3><div class="hint">Number of trade schemes and the SKUs they cover.</div><div id="cSchCh"></div></div>
    <div class="card"><h3>Booked discounts by month</h3><div class="hint">Amount actually deducted on order rows, by scheme type.</div><div id="cBooked"></div></div>
  </div>
  <div class="card" style="margin-top:12px">
    <h3>Trade scheme master</h3>
    <div class="hint">Every scheme with its slab structure. Free quantity is the reward per slab.</div>
    <div class="toolbar"><input id="scq" type="search" placeholder="Search item…"/><select id="scf"><option value="">All schemes</option><option value="a">Active only</option><option value="now">In force in Nov-2026</option></select><span class="small" id="scc"></span></div>
    <div class="scroll" style="max-height:480px"><table id="tSch"><thead><tr>
      <th>Scheme</th><th>Item</th><th>Channel</th><th>Slabs</th><th>Base range</th><th>Free qty</th><th>Offer %</th><th>Amount</th><th>Valid from</th><th>To</th><th>Status</th>
    </tr></thead><tbody></tbody></table></div>
  </div>
  <div class="grid g2" style="margin-top:12px">
    <div class="card"><h3>Booked discount detail</h3><div class="hint">What was deducted in the ERP, by month and scheme.</div><div class="wrap"><table id="tBooked"><thead><tr><th>Month</th><th>Scheme</th><th>Lines</th><th>BDT</th></tr></thead><tbody></tbody></table></div></div>
    <div class="card"><h3>Free goods by month</h3><div class="hint">Free quantity attached to paid orders across all SKUs.</div><div id="cFree"></div></div>
  </div>
</section>

<section id="cmp">
  <div class="guide">
    <div><div class="gl">What this answers</div><p>When our price moved, did volume follow because of us — or because the whole market moved? This compares our realized price with the same pack sold by competitor brands.</p></div>
    <div><div class="gl">How to read it</div><p>Comparison is like-for-like: same product form and same pack size (e.g. Chinigura 1kg vs Chinigura 1kg), not a category average. “Premium vs MRP/DP” is our realized price against the market average. The verdict says whether we led the market, followed it, or moved against it.</p></div>
    <div><div class="gl">Source</div><p>oms.tblCompetitorPriceHeader / Row / Product — market price surveys by brand and pack. Coverage is limited: <b>May–Dec 2024 only</b>, and bulk 50 KG rows carry no MRP in the ERP.</p></div>
  </div>
  <div class="grid g4">
    <div class="card kpi"><div class="lab">Competitor brands tracked</div><div class="val" id="m1"></div><div class="note">across rice, flour, oil, salt, sugar</div></div>
    <div class="card kpi"><div class="lab">Benchmark packs</div><div class="val" id="m2"></div><div class="note">form + pack size with market prices</div></div>
    <div class="card kpi"><div class="lab">Survey window</div><div class="val" id="m3"></div><div class="note">competitor price data</div></div>
    <div class="card kpi"><div class="lab">Our SKUs matched</div><div class="val" id="m4"></div><div class="note">comparable to a market pack</div></div>
  </div>
  <div class="card" style="margin-top:12px">
    <h3>Our price vs market — same pack</h3>
    <div class="hint">Indexed to the first survey month (=100). Amber = market average MRP, blue = our realized price.</div>
    <div class="toolbar"><select id="cmpPick" style="min-width:320px"></select><span class="small" id="cmpNote"></span></div>
    <div id="cCmp"></div>
  </div>
  <div class="card" style="margin-top:12px">
    <h3>Pack-level comparison</h3>
    <div class="hint">Packs where we and the market both have a price. Our price is net of trade terms, so the DP column is the fair benchmark; the MRP column is the retail-facing view. Change columns cover the survey window.</div>
    <div class="scroll" style="max-height:460px"><table id="tCmp"><thead><tr>
      <th>Pack</th><th>Category</th><th>Market MRP</th><th>Market DP</th><th>Our price</th><th>vs MRP</th><th>vs DP</th><th>Our vol</th><th>Our price Δ</th><th>Market Δ</th><th>Verdict</th>
    </tr></thead><tbody></tbody></table></div>
  </div>
  <div class="card" style="margin-top:12px">
    <h3>Competitor benchmark</h3>
    <div class="hint">Average price per brand and pack over the survey window. Essential (us) is highlighted.</div>
    <div class="toolbar"><input id="bq" type="search" placeholder="Search brand or pack…"/><select id="bf"><option value="">All groups</option></select><span class="small" id="bc"></span></div>
    <div class="scroll" style="max-height:440px"><table id="tBench"><thead><tr><th>Brand</th><th>Pack</th><th>Group</th><th>MRP</th><th>DP</th><th>TP</th><th>MRP range</th><th>Obs</th></tr></thead><tbody></tbody></table></div>
  </div>
  <div class="card" style="margin-top:12px"><div class="note-box warn"><b>Coverage limit.</b> Competitor prices were surveyed May–Dec 2024 only, so this section compares that window — it does not run with the 2022-26 price history. Bulk 50 KG packs are recorded without MRP/DP/TP in the ERP, so bulk is excluded from the premium calculation. Where no competitor pack exists for our SKU, the SKU is simply not comparable and is left out rather than estimated.</div></div>
</section>

<section id="pg">
  <div class="guide">
    <div><div class="gl">What this answers</div><p>What price has AEL actually declared for each SKU — distributor price, trade price and MRP — and how far is the realized price from it?</p></div>
    <div><div class="gl">How to read it</div><p>DP is the Distributor channel price (what the distributor pays). TP is the Dealer channel price (what the retailer pays). MRP is the consumer price. Gap to TP shows whether the SKU is trading above or below its declared trade price — a large negative gap means the grid is stale or discounts are deep.</p></div>
    <div><div class="gl">Source</div><p>itm.tblPriceSetup (channels 70 Dealer and 71 Distributor, monthly since Jul-2023) and rtm.tblRetailPrice / tblRetailPriceLog (which also carries MRP). Blank means the ERP holds no declared price for that SKU.</p></div>
  </div>
  <div class="grid g4">
    <div class="card kpi"><div class="lab">SKUs with a declared DP</div><div class="val" id="p1"></div><div class="note">distributor channel price</div></div>
    <div class="card kpi"><div class="lab">With a declared TP</div><div class="val" id="p2"></div><div class="note">dealer channel price</div></div>
    <div class="card kpi"><div class="lab">With MRP</div><div class="val" id="p3"></div><div class="note">retail price table</div></div>
    <div class="card kpi"><div class="lab">Trading below declared TP</div><div class="val" id="p4"></div><div class="note">realized net price vs TP</div></div>
  </div>
  <div class="grid g2" style="margin-top:12px">
    <div class="card"><h3>Realized price vs declared TP</h3><div class="hint">Each SKU plotted by how far its latest realized price sits above (red) or below (teal) its declared trade price.</div><div id="cGap"></div></div>
    <div class="card"><h3>Price ladder</h3><div class="hint">DP to TP dealer margin and TP to MRP retail headroom, as a share of MRP.</div><div id="cLadder"></div>
      <div class="legend"><span><i style="background:#2dd4bf"></i>DP to TP (dealer)</span><span><i style="background:#f5a524"></i>TP to MRP (retail)</span></div>
    </div>
  </div>
  <div class="card" style="margin-top:12px">
    <h3>Declared price grid — every SKU the ERP prices</h3>
    <div class="hint">Latest declared values. Click a row to open its month-on-month history.</div>
    <div class="toolbar"><input id="pgq" type="search" placeholder="Search SKU…"/><select id="pgf"><option value="">All</option><option value="dp">Has DP</option><option value="tp">Has TP</option><option value="mrp">Has MRP</option><option value="gap">Realized below TP</option></select><span class="small" id="pgc"></span></div>
    <div class="scroll"><table id="tPg"><thead><tr>
      <th data-s="n">SKU</th><th data-s="dp">DP</th><th data-s="tp">TP</th><th data-s="mrp">MRP</th>
      <th data-s="dd">Dealer margin %</th><th data-s="rt">Retail headroom %</th><th data-s="p1">Realized</th>
      <th data-s="gap">Realized vs TP</th><th data-s="dm">Months w/ DP</th><th data-s="dd">Last declared</th><th>Source</th>
    </tr></thead><tbody></tbody></table></div>
  </div>
</section>

<section id="dec">
  <div class="guide">
    <div><div class="gl">What this answers</div><p>Where the business is heading, what has to be decided, what to do now, which SKUs are at risk, and how to recover the revenue gap — in that order.</p></div>
    <div><div class="gl">How to read it</div><p>Five blocks, each pairing a plain-language summary with a proof table and a chart. Fiscal years are <b>July–June</b>; FY27 is the year that started July 2026. Every block is recomputed from the period / channel / category filters at the top.</p></div>
    <div><div class="gl">Source &amp; a caveat</div><p>Orders (net revenue), deliveries and zones from the ERP; declared DP/TP/MRP from the price grid; elasticity from monthly price–volume. <b>COGS is not posted for AEL</b> (0 of 234,781 delivery lines carry a cost), so margin-based “loss-making” screening is replaced by price-realisation risk — stated where it applies.</p></div>
  </div>
  <div class="note-box" id="ddaHead" style="margin-bottom:12px"></div>

  <div class="card" style="margin-top:12px">
    <h3>01 · Direction — where the business is heading</h3>
    <div class="hint">Monthly net revenue with fiscal-year boundaries. The table proves the trajectory; the SMART box states what it means.</div>
    <div id="cDir"></div>
    <div class="grid g2" style="margin-top:12px">
      <div><table id="tFy"><thead><tr><th>Fiscal year</th><th>Revenue</th><th>YoY</th><th>Deliveries</th><th>Active SKUs</th></tr></thead><tbody></tbody></table></div>
      <div id="smartDir"></div>
    </div>
  </div>

  <div class="card" style="margin-top:12px">
    <h3>02 · Decision — what has to be decided</h3>
    <div class="hint">Three decisions the data supports. Each card carries the number behind it.</div>
    <div class="grid g3" id="decCards"></div>
    <div id="cDec" style="margin-top:14px"></div>
    <div class="scroll" style="margin-top:12px"><table id="tDec"><thead><tr>
      <th>SKU</th><th>Category</th><th>Revenue</th><th>Revenue FY27 vs FY26</th><th>Realized vs TP</th><th>β</th><th>Read</th>
    </tr></thead><tbody></tbody></table></div>
  </div>

  <div class="card" style="margin-top:12px">
    <h3>03 · Action — what to do now</h3>
    <div class="hint">Prioritised moves, each with the evidence that justifies it.</div>
    <div class="scroll"><table id="tAct"><thead><tr><th>#</th><th>Priority</th><th>Action</th><th>Evidence</th><th>Owner</th></tr></thead><tbody></tbody></table></div>
  </div>

  <div class="card" style="margin-top:12px">
    <h3>04 · At-risk SKUs — price realisation</h3>
    <div class="hint">SKUs trading materially below their declared trade price, and SKUs losing both price and volume. This is a realisation-risk screen, not a P&amp;L loss screen.</div>
    <div id="cRisk"></div>
    <div class="scroll" style="margin-top:12px"><table id="tRisk"><thead><tr>
      <th>SKU</th><th>Category</th><th>Revenue</th><th>Realized</th><th>Declared TP</th><th>Gap</th><th>Price Δ</th><th>Volume Δ</th><th>Direction</th><th>Action</th>
    </tr></thead><tbody></tbody></table></div>
    <div class="note-box warn" id="riskNote" style="margin-top:12px"></div>
  </div>

  <div class="card" style="margin-top:12px">
    <h3>05 · Loss recovery plan</h3>
    <div class="hint">Same months, year on year, with the gap split by category and a SMART recovery plan.</div>
    <div id="cRec"></div>
    <div class="grid g2" style="margin-top:12px">
      <div><h3 style="font-size:12.5px;margin:0 0 6px">Where the gap came from</h3><div id="recDrivers"></div></div>
      <div><h3 style="font-size:12.5px;margin:0 0 6px">Recovery plan — SMART</h3><div id="recPlan"></div></div>
    </div>
    <div class="scroll" style="margin-top:12px"><table id="tRec"><thead><tr><th>Month</th><th>This FY</th><th>Last FY</th><th>Gap</th><th>Gap %</th></tr></thead><tbody></tbody></table></div>
  </div>
</section>

<section id="mt">
  <div class="grid g2">
    <div class="card"><h3>Sources</h3>
      <table><tbody>
        <tr><td>Volume, revenue, discounts, free goods</td><td style="text-align:left" class="small">oms.tblSalesOrderRow + tblSalesOrderHeader (BU 144)</td></tr>
        <tr><td>Declared DP</td><td style="text-align:left" class="small">itm.tblPriceSetup — channel 71 (Distributor price), monthly since Jul-2023; fallback rtm.tblRetailPrice</td></tr>
        <tr><td>Declared TP</td><td style="text-align:left" class="small">itm.tblPriceSetup — channel 70 (Dealer price); fallback rtm.tblRetailPrice</td></tr>
        <tr><td>MRP</td><td style="text-align:left" class="small">rtm.tblRetailPrice + tblRetailPriceLog — the only MRP source in the ERP</td></tr>
        <tr><td>SKU master / UOM</td><td style="text-align:left" class="small">itm.tblItem</td></tr>
      </tbody></table>
      <div class="small" style="margin-top:10px">Window: ${MONTHS[0]} → ${MONTHS[MONTHS.length-1]}. First active order 2022-03-01.</div>
    </div>
    <div class="card"><h3>Method</h3>
      <ul class="small" style="margin:0;padding-left:18px;line-height:1.85">
        <li>Realized price = net value ÷ quantity, per selling unit as booked.</li>
        <li>Month-on-month price compares to the previous month <i>with sales</i> for that SKU.</li>
        <li>Elasticity = slope of Δln(volume) on Δln(realized price) between consecutive months (first-difference estimator), which strips out the shared cost/season trend. Needs 15+ monthly differences and |β|≤8 to be reported; the level (log-log) estimate is shown alongside.</li>
        <li>Declared price for a SKU-month resolves in this order: channel price grid (DP = channel 71, TP = channel 70) → retail price log (DP/TP/MRP) → blank. MRP comes only from the retail table.</li>
        <li>Volume is in each SKU's own selling unit — never add volumes across SKUs.</li>
        <li>Where realized price ÷ MRP is outside 0.35–1.6 the booked unit does not reconcile to the declared pack; flagged “unit ?”.</li>
      </ul>
    </div>
  </div>
  <div class="card" style="margin-top:12px"><h3>Coverage</h3>
    <table><thead><tr><th>Area</th><th style="text-align:left">Status</th></tr></thead><tbody>
      <tr><td>SKU × month volume &amp; revenue</td><td style="text-align:left"><span class="tag t-neg">Complete</span> ${P.rows.length.toLocaleString()} SKU-months, ${SKU_COUNT} SKUs</td></tr>
      <tr><td>Realized price &amp; MoM change</td><td style="text-align:left"><span class="tag t-neg">Complete</span> derived from net value ÷ qty</td></tr>
      <tr><td>Declared DP / TP / MRP history</td><td style="text-align:left"><span class="tag t-pos">Partial</span> ${DECLARED} of ${SKU_COUNT} SKUs priced in the ERP — DP on ${ROWS.filter(r=>r.dp!=null).length}, TP on ${ROWS.filter(r=>r.tp!=null).length}, MRP on ${ROWS.filter(r=>r.mrp!=null).length}; grid from Jul-2023, retail log from Oct-2023</td></tr>
      <tr><td>Item-level trade discounts</td><td style="text-align:left"><span class="tag t-pos">Partial</span> booked from 10-Oct-2026</td></tr>
      <tr><td>Channel mix (SKU × channel × month)</td><td style="text-align:left"><span class="tag t-pos">Partial</span> last 24 months (Dec-2024 → Nov-2026); older months are all-channel only</td></tr>
      <tr><td>Trade scheme master</td><td style="text-align:left"><span class="tag t-pos">Partial</span> 149 schemes from Dec-2025 (rtm)</td></tr>
      <tr><td>Booked item discounts</td><td style="text-align:left"><span class="tag t-pos">Partial</span> from 10-Oct-2026 only</td></tr>
      <tr><td>Free goods</td><td style="text-align:left"><span class="tag t-neg">Complete</span> full window, item level</td></tr>
      <tr><td>Cost / COGS per SKU</td><td style="text-align:left"><span class="tag t-mut">Not in this extract</span></td></tr>
    </tbody></table>
  </div>
</section>
</main>
<footer>${CFG.buShort} Price &amp; Volume History Cockpit · ${MONTHS[0]} → ${MONTHS[MONTHS.length-1]} · values in BDT · generated from live ERP extract</footer>
`;

const client = fs.readFileSync(path.join(ROOT, "client.frag.html"), "utf8");
const out = page + client.split("__PAYLOAD__").join(JSON.stringify(PAY));
fs.writeFileSync(path.join(ROOT, "AEL_Price_Elasticity_Cockpit.html"), out);
console.log("HTML", (out.length/1024/1024).toFixed(2)+" MB");
console.log("rows", ROWS.length, "elastic", EL.length, "months", MONTHS.length);
