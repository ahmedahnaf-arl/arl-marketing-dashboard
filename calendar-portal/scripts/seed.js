// Seed the 56 baseline FY26-27 activities (idempotent). Run: npm run db:seed
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import pg from "pg";
import { SEED_PLANS } from "../lib/seed-data.js";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set. Add it to .env or the environment.");
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const sql = `
    INSERT INTO plans
      (id, activity_date, sbu, activity, category, goal, budget_cr, kpi, responsible, status, progress)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    ON CONFLICT (activity_date, sbu, activity) DO NOTHING
  `;

  let inserted = 0;
  for (const [date, sbu, activity, category, goal, budget_cr, kpi, responsible, status] of SEED_PLANS) {
    const progress = status === "Completed" ? 100 : status === "In Progress" ? 50 : 0;
    const res = await pool.query(sql, [
      crypto.randomUUID(), date, sbu, activity, category, goal, budget_cr, kpi, responsible, status, progress,
    ]);
    inserted += res.rowCount;
  }

  const { rows } = await pool.query("SELECT count(*)::int AS c FROM plans");
  console.log(`✓ seeded: ${inserted} new rows inserted (total now ${rows[0].c})`);
  await pool.end();
}
main().catch((e) => {
  console.error("Seed failed:", e.message);
  process.exit(1);
});
