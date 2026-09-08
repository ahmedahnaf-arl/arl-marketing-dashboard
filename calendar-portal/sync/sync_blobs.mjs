// Sync helper for Netlify Blobs (the portal's data store).
// Usage:
//   node sync/sync_blobs.mjs push --in plans.json        # merge workbook rows into Blobs, keep portal rows
//   node sync/sync_blobs.mjs dump --out blobs.json       # dump all Blobs rows to JSON
//   node sync/sync_blobs.mjs mark-synced --ids ids.json  # set synced_to_sheet=true on listed ids
// Requires env: SITE_ID, NETLIFY_TOKEN
import { getStore } from "@netlify/blobs";
import fs from "node:fs";

const KEY = "plans-data";
const siteID = process.env.SITE_ID;
const token = process.env.NETLIFY_TOKEN;

if (!siteID || !token) {
  console.error("SITE_ID and NETLIFY_TOKEN env vars are required.");
  process.exit(1);
}

const store = getStore("plans", { siteID, token });

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

async function load() {
  let raw = null;
  try { raw = await store.get(KEY, { type: "json" }); } catch (e) { console.error("get failed:", e.message); }
  return Array.isArray(raw) ? raw : [];
}

async function save(rows) {
  await store.setJSON(KEY, rows);
  return rows;
}

const cmd = process.argv[2];

if (cmd === "push") {
  const infile = arg("--in") || "plans.json";
  const workbookRows = JSON.parse(fs.readFileSync(infile, "utf8"));
  const current = await load();
  const portalRows = current.filter((p) => p.created_by != null && p.source !== "workbook");
  const merged = [...workbookRows, ...portalRows];
  await save(merged);
  console.log(`pushed: ${workbookRows.length} workbook rows + ${portalRows.length} portal rows = ${merged.length} total`);
}

else if (cmd === "dump") {
  const outfile = arg("--out") || "blobs.json";
  const rows = await load();
  fs.writeFileSync(outfile, JSON.stringify(rows, null, 1));
  console.log(`dumped ${rows.length} rows to ${outfile}`);
}

else if (cmd === "mark-synced") {
  const idsfile = arg("--ids");
  const ids = new Set(JSON.parse(fs.readFileSync(idsfile, "utf8")));
  const rows = await load();
  let n = 0;
  for (const r of rows) {
    if (ids.has(r.id) && !r.synced_to_sheet) { r.synced_to_sheet = true; n++; }
  }
  await save(rows);
  console.log(`marked ${n} rows synced`);
}

else {
  console.error("Unknown command. Use push | dump | mark-synced");
  process.exit(1);
}
