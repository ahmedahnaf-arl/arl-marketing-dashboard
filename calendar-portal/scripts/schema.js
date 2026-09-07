// Create the `plans` table (idempotent). Run: npm run db:schema
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

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

const DDL = `
CREATE TABLE IF NOT EXISTS plans (
  id            text PRIMARY KEY,
  activity_date date NOT NULL,
  sbu           text NOT NULL,
  activity      text NOT NULL,
  category      text NOT NULL,
  goal          text,
  budget_cr     numeric(14,2) DEFAULT 0,
  kpi           text,
  responsible   text,
  status        text NOT NULL DEFAULT 'Planned',
  progress      integer DEFAULT 0,
  actual_spend  numeric(16,2) DEFAULT 0,
  notes         text,
  created_by    text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  CONSTRAINT plans_uq UNIQUE (activity_date, sbu, activity)
);
CREATE INDEX IF NOT EXISTS idx_plans_date ON plans(activity_date);
CREATE INDEX IF NOT EXISTS idx_plans_sbu  ON plans(sbu);
CREATE INDEX IF NOT EXISTS idx_plans_cat  ON plans(category);
`;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set. Add it to .env or the environment.");
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(DDL);
  console.log("✓ schema applied (table `plans` ready)");
  await pool.end();
}
main().catch((e) => {
  console.error("Schema failed:", e.message);
  process.exit(1);
});
