const { getStore } = require("@netlify/blobs");
const crypto = require("node:crypto");
const SEED = require("./seed.json");

const KEY = "plans-data";
const UPDATABLE = [
  "activity_date", "sbu", "activity", "category", "goal", "budget_cr",
  "kpi", "responsible", "status", "progress", "actual_spend", "notes",
];

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
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
}

let memStore = null;

function getStoreSafe() {
  try {
    return getStore("plans", {
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOBS_TOKEN,
    });
  } catch (_) { return null; }
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
    } catch (_) { /* fall through to memory */ }
  }
  if (!memStore) memStore = seedRows();
  return memStore;
}

async function savePlans(rows) {
  memStore = rows;
  const store = getStoreSafe();
  if (store) { try { await store.setJSON(KEY, rows); } catch (_) {} }
  return rows;
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
};

exports.handler = async (event) => {
  const method = event.httpMethod;

  if (method === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }

  try {
    const plans = await loadPlans();

    if (method === "GET") {
      const q = event.queryStringParameters || {};
      let rows = plans.slice();
      if (q.sbu) rows = rows.filter((p) => p.sbu === q.sbu);
      if (q.category) rows = rows.filter((p) => p.category === q.category);
      if (q.status) rows = rows.filter((p) => p.status === q.status);
      if (q.month) rows = rows.filter((p) => p.activity_date.slice(0, 7) === q.month);
      if (q.q) {
        const s = q.q.toLowerCase();
        rows = rows.filter((p) =>
          [p.activity, p.goal, p.kpi, p.responsible, p.sbu].some((v) => v && String(v).toLowerCase().includes(s))
        );
      }
      rows.sort((a, b) => (a.activity_date + a.sbu).localeCompare(b.activity_date + b.sbu));
      return json({ data: rows, total: rows.length }, cors);
    }

    if (method === "POST") {
      const body = JSON.parse(event.body || "{}");
      if (!body.activity_date || !body.sbu || !body.activity || !body.category) {
        return json({ error: "activity_date, sbu, activity and category are required." }, cors, 400);
      }
      const id = crypto.randomUUID();
      const record = {
        id,
        activity_date: body.activity_date,
        sbu: body.sbu,
        activity: body.activity,
        category: body.category,
        goal: body.goal || null,
        budget_cr: num(body.budget_cr),
        kpi: body.kpi || null,
        responsible: body.responsible || null,
        status: body.status || "Planned",
        progress: body.progress == null || body.progress === "" ? 0 : Number(body.progress),
        actual_spend: num(body.actual_spend),
        notes: body.notes || null,
        created_by: body.created_by || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const idx = plans.findIndex(
        (p) => p.activity_date === record.activity_date && p.sbu === record.sbu && p.activity === record.activity
      );
      if (idx >= 0) {
        record.id = plans[idx].id;
        record.created_at = plans[idx].created_at;
        plans[idx] = record;
      } else {
        plans.push(record);
      }
      await savePlans(plans);
      return json({ data: record }, cors, 201);
    }

    // PATCH / DELETE identified by ?id=
    const id = (event.queryStringParameters || {}).id;
    const idx = plans.findIndex((p) => p.id === id);
    if (idx < 0) {
      return json({ error: "Not found" }, cors, 404);
    }

    if (method === "PATCH") {
      const body = JSON.parse(event.body || "{}");
      for (const f of UPDATABLE) {
        if (body[f] !== undefined) {
          let v = body[f];
          if (f === "budget_cr" || f === "actual_spend" || f === "progress") v = num(v);
          plans[idx][f] = v;
        }
      }
      plans[idx].updated_at = new Date().toISOString();
      await savePlans(plans);
      return json({ data: plans[idx] }, cors);
    }

    if (method === "DELETE") {
      plans.splice(idx, 1);
      await savePlans(plans);
      return json({ ok: true }, cors);
    }

    return json({ error: "Method not allowed" }, cors, 405);
  } catch (e) {
    return json({ error: e.message || "Server error" }, cors, 500);
  }
};

function num(v) {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function json(obj, headers, statusCode = 200) {
  return { statusCode, headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(obj) };
}
