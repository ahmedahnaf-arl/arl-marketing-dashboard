import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const UPDATABLE = [
  "activity_date", "sbu", "activity", "category", "goal", "budget_cr",
  "kpi", "responsible", "status", "progress", "actual_spend", "notes",
];

export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const sets = [];
    const vals = [];
    let i = 1;
    for (const f of UPDATABLE) {
      if (body[f] !== undefined) {
        sets.push(`${f} = $${i++}`);
        let v = body[f];
        if (f === "budget_cr" || f === "actual_spend" || f === "progress") {
          v = v === "" || v == null ? 0 : Number(v);
        }
        vals.push(v);
      }
    }
    if (!sets.length) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }
    sets.push(`updated_at = now()`);
    vals.push(id);

    const sql = `UPDATE plans SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`;
    const { rows } = await query(sql, vals);
    if (!rows.length) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return NextResponse.json({ data: rows[0] });
  } catch (e) {
    console.error("PATCH /api/plans failed:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { id } = await params;
    const { rowCount } = await query("DELETE FROM plans WHERE id = $1", [id]);
    if (!rowCount) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/plans failed:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
