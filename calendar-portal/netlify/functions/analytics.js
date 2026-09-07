const { getStore } = require("@netlify/blobs");
const crypto = require("node:crypto");
const SEED = require("./seed.json");
const CONFIG = (() => { try { return require("./blobs-config.json"); } catch (_) { return null; } })();

const KEY = "plans-data";

function seedRows() {
  return SEED.map((s) => ({
    id: crypto.randomUUID(),
    activity_date: s.activity_date,
    sbu: s.sbu,
    activity: s.activity,
    category: s.category,
    goal: s.goal || null,
    budget_cr: Number(s.budget_cr) || 0,
    kpi: s.kpi || null,
    responsible: s.responsible || null,
    status: s.status,
    progress: s.status === "Completed" ? 100 : s.status === "In Progress" ? 50 : 0,
    actual_spend: 0,
    notes: null,
    created_by: null,
    last_edited_by: null,
  }));
}

let memStore = null;
let lastError = null;

function getStoreSafe() {
  if (CONFIG && CONFIG.siteID && CONFIG.token) {
    try { return getStore("plans", { siteID: CONFIG.siteID, token: CONFIG.token }); } catch (e) { lastError = "getStore: " + e.message; }
  }
  return null;
}

async function loadPlans() {
  const store = getStoreSafe();
  if (store) {
    try {
      const raw = await store.get(KEY, { type: "json" });
      if (Array.isArray(raw)) return raw;
      const seeded = seedRows();
      await store.setJSON(KEY, seeded);
      return seeded;
    } catch (e) { lastError = "blob: " + (e && e.message ? e.message : String(e)); }
  }
  if (!memStore) memStore = seedRows();
  return memStore;
}

exports.handler = async () => {
  try {
    const plans = await loadPlans();

    const status = {};
    const byCategoryMap = {};
    const bySbuMap = {};
    const byMonthMap = {};
    let budget = 0;
    let spend = 0;
    let total = plans.length;
    let planned = 0, in_progress = 0, completed = 0, on_hold = 0, cancelled = 0;
    let progressSum = 0;

    for (const p of plans) {
      status[p.status] = (status[p.status] || 0) + 1;
      if (p.status === "Planned") planned++;
      else if (p.status === "In Progress") in_progress++;
      else if (p.status === "Completed") completed++;
      else if (p.status === "On Hold") on_hold++;
      else if (p.status === "Cancelled") cancelled++;

      const cat = p.category || "Uncategorised";
      byCategoryMap[cat] = byCategoryMap[cat] || { category: cat, count: 0, budget: 0 };
      byCategoryMap[cat].count += 1;
      byCategoryMap[cat].budget += Number(p.budget_cr) || 0;

      bySbuMap[p.sbu] = bySbuMap[p.sbu] || { sbu: p.sbu, count: 0, budget: 0 };
      bySbuMap[p.sbu].count += 1;
      bySbuMap[p.sbu].budget += Number(p.budget_cr) || 0;

      const m = p.activity_date.slice(0, 7);
      byMonthMap[m] = (byMonthMap[m] || 0) + 1;

      budget += Number(p.budget_cr) || 0;
      spend += Number(p.actual_spend) || 0;
      progressSum += Number(p.progress) || 0;
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        status: Object.entries(status).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
        byCategory: Object.values(byCategoryMap).sort((a, b) => b.budget - a.budget),
        bySbu: Object.values(bySbuMap).sort((a, b) => b.budget - a.budget),
        byMonth: Object.entries(byMonthMap).map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month)),
        budget: { budget, spend },
        totals: { total, planned, in_progress, completed, on_hold, cancelled, avg_progress: total ? progressSum / total : 0 },
      }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: e.message || "Server error" }),
    };
  }
};
