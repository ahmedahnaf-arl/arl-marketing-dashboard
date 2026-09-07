import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { bootstrap } from "@/lib/bootstrap";

export async function GET() {
  try {
    await bootstrap();
    const [statusRes, catRes, sbuRes, monthRes, budgetRes, totalRes] = await Promise.all([
      query(`SELECT status, count(*)::int AS count FROM plans GROUP BY status ORDER BY count DESC`),
      query(`SELECT category, count(*)::int AS count, coalesce(sum(budget_cr),0)::float AS budget
             FROM plans GROUP BY category ORDER BY budget DESC`),
      query(`SELECT sbu, count(*)::int AS count, coalesce(sum(budget_cr),0)::float AS budget
             FROM plans GROUP BY sbu ORDER BY budget DESC`),
      query(`SELECT to_char(activity_date,'YYYY-MM') AS month, count(*)::int AS count
             FROM plans GROUP BY 1 ORDER BY 1`),
      query(`SELECT coalesce(sum(budget_cr),0)::float AS budget, coalesce(sum(actual_spend),0)::float AS spend FROM plans`),
      query(`SELECT count(*)::int AS total,
                    count(*) FILTER (WHERE status='Planned')::int AS planned,
                    count(*) FILTER (WHERE status='In Progress')::int AS in_progress,
                    count(*) FILTER (WHERE status='Completed')::int AS completed,
                    count(*) FILTER (WHERE status='On Hold')::int AS on_hold,
                    count(*) FILTER (WHERE status='Cancelled')::int AS cancelled,
                    avg(progress)::float AS avg_progress
             FROM plans`),
    ]);

    return NextResponse.json({
      status: statusRes.rows,
      byCategory: catRes.rows,
      bySbu: sbuRes.rows,
      byMonth: monthRes.rows,
      budget: budgetRes.rows[0],
      totals: totalRes.rows[0],
    });
  } catch (e) {
    console.error("GET /api/analytics failed:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
