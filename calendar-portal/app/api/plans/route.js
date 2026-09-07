import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { query } from "@/lib/db";
import { bootstrap } from "@/lib/bootstrap";

const ALLOWED_FIELDS = [
  "activity_date", "sbu", "activity", "category", "goal", "budget_cr",
  "kpi", "responsible", "status", "progress", "actual_spend", "notes", "created_by",
];

export async function GET(req) {
  try {
    await bootstrap();
    const { searchParams } = new URL(req.url);
    const sbu = searchParams.get("sbu");
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const month = searchParams.get("month"); // YYYY-MM
    const q = (searchParams.get("q") || "").trim();

    const where = [];
    const params = [];
    let i = 1;
    if (sbu) { where.push(`sbu = $${i++}`); params.push(sbu); }
    if (category) { where.push(`category = $${i++}`); params.push(category); }
    if (status) { where.push(`status = $${i++}`); params.push(status); }
    if (month) { where.push(`to_char(activity_date,'YYYY-MM') = $${i++}`); params.push(month); }
    if (q) {
      where.push(`(activity ILIKE $${i} OR goal ILIKE $${i} OR kpi ILIKE $${i} OR responsible ILIKE $${i} OR sbu ILIKE $${i})`);
      params.push(`%${q}%`);
      i++;
    }

    const sql = `
      SELECT * FROM plans
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY activity_date ASC, sbu ASC
    `;
    const { rows } = await query(sql, params);
    return NextResponse.json({ data: rows, total: rows.length });
  } catch (e) {
    console.error("GET /api/plans failed:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await bootstrap();
    const body = await req.json();
    const { activity_date, sbu, activity, category } = body;

    if (!activity_date || !sbu || !activity || !category) {
      return NextResponse.json(
        { error: "activity_date, sbu, activity and category are required." },
        { status: 400 }
      );
    }

    const values = {
      activity_date,
      sbu,
      activity,
      category,
      goal: body.goal ?? null,
      budget_cr: body.budget_cr === "" || body.budget_cr == null ? 0 : Number(body.budget_cr),
      kpi: body.kpi ?? null,
      responsible: body.responsible ?? null,
      status: body.status ?? "Planned",
      progress: body.progress == null || body.progress === "" ? 0 : Number(body.progress),
      actual_spend: body.actual_spend == null || body.actual_spend === "" ? 0 : Number(body.actual_spend),
      notes: body.notes ?? null,
      created_by: body.created_by ?? null,
    };

    const id = crypto.randomUUID();
    const cols = Object.keys(values);
    const placeholders = cols.map((_, idx) => `$${idx + 2}`);
    const sql = `
      INSERT INTO plans (id, ${cols.join(", ")})
      VALUES ($1, ${placeholders.join(", ")})
      ON CONFLICT (activity_date, sbu, activity) DO UPDATE SET
        category = EXCLUDED.category,
        goal = EXCLUDED.goal,
        budget_cr = EXCLUDED.budget_cr,
        kpi = EXCLUDED.kpi,
        responsible = EXCLUDED.responsible,
        status = EXCLUDED.status,
        progress = EXCLUDED.progress,
        actual_spend = EXCLUDED.actual_spend,
        notes = EXCLUDED.notes,
        updated_at = now()
      RETURNING *
    `;
    const { rows } = await query(sql, [id, ...cols.map((c) => values[c])]);
    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (e) {
    console.error("POST /api/plans failed:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
