// Idempotent bootstrap: create the table if missing and seed the 56 baseline
// activities if the table is empty. Called lazily from read endpoints so the
// portal "just works" against a freshly provisioned (empty) Postgres database.
import { query } from "@/lib/db";
import { SEED_PLANS } from "@/lib/seed-data";
import crypto from "node:crypto";

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

const globalForBootstrap = globalThis;
let done = false;
let inflight = null;

export async function bootstrap() {
  if (done) return;
  if (inflight) return inflight;

  inflight = (async () => {
    await query(DDL);
    const { rows } = await query("SELECT count(*)::int AS c FROM plans");
    if (rows[0].c === 0) {
      const sql = `
        INSERT INTO plans
          (id, activity_date, sbu, activity, category, goal, budget_cr, kpi, responsible, status, progress)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (activity_date, sbu, activity) DO NOTHING
      `;
      for (const [date, sbu, activity, category, goal, budget_cr, kpi, responsible, status] of SEED_PLANS) {
        const progress = status === "Completed" ? 100 : status === "In Progress" ? 50 : 0;
        await query(sql, [
          crypto.randomUUID(), date, sbu, activity, category, goal, budget_cr, kpi, responsible, status, progress,
        ]);
      }
      console.log(`[bootstrap] seeded ${SEED_PLANS.length} baseline activities`);
    }
    done = true;
  })();

  return inflight;
}
