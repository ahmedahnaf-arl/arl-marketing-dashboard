"use client";

import { useEffect, useMemo, useState } from "react";
import { CATEGORIES, SBUS, STATUSES, STATUS_COLORS, CATEGORY_COLORS, fmtCr } from "@/lib/constants";

const MONTHS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];

function monthLabel(ym) {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[m - 1]}-${String(y).slice(2)}`;
}

export default function Dashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // filters
  const [fSbu, setFSbu] = useState("");
  const [fCat, setFCat] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fQ, setFQ] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [aRes, pRes] = await Promise.all([fetch("/api/analytics"), fetch("/api/plans")]);
      if (!aRes.ok || !pRes.ok) throw new Error("Failed to load data");
      setAnalytics(await aRes.json());
      setPlans((await pRes.json()).data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return plans.filter((p) => {
      if (fSbu && p.sbu !== fSbu) return false;
      if (fCat && p.category !== fCat) return false;
      if (fStatus && p.status !== fStatus) return false;
      if (fQ) {
        const hay = `${p.activity} ${p.goal || ""} ${p.kpi || ""} ${p.responsible || ""} ${p.sbu}`.toLowerCase();
        if (!hay.includes(fQ.toLowerCase())) return false;
      }
      return true;
    });
  }, [plans, fSbu, fCat, fStatus, fQ]);

  async function patchPlan(id, patch) {
    await fetch(`/api/plans/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    load();
  }

  if (loading && !analytics) {
    return (
      <div className="wrap">
        <div className="pagehead"><p>Loading dashboard…</p></div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="wrap">
        <div className="pagehead"><p className="err">Error: {error}</p></div>
        <div className="note">
          Make sure the backend is configured: set <b>DATABASE_URL</b> (and <b>DATABASE_SSL=true</b> for cloud
          Postgres) in <b>.env</b>, run <b>npm run db:schema</b> and <b>npm run db:seed</b>, then restart.
        </div>
      </div>
    );
  }

  const t = analytics.totals;
  const maxCat = Math.max(1, ...analytics.byCategory.map((c) => c.count));
  const maxSbu = Math.max(1, ...analytics.bySbu.map((c) => c.count));
  const maxBudget = Math.max(1, ...analytics.byCategory.map((c) => c.budget));
  const maxMonth = Math.max(1, ...analytics.byMonth.map((c) => c.count));

  return (
    <div className="wrap" style={{ paddingBottom: 60 }}>
      <div className="pagehead">
        <h2>Growth Analytics Dashboard</h2>
        <p>Consolidated Marketing, Business Development &amp; Growth activity calendar — FY 2026-27 (live).</p>
      </div>

      <div className="stats">
        <div className="stat blue"><div className="v">{t.total}</div><div className="k">Total Activities</div></div>
        <div className="stat"><div className="v">{fmtCr(analytics.budget.budget)}</div><div className="k">Planned Budget</div></div>
        <div className="stat amber"><div className="v">{t.in_progress}</div><div className="k">In Progress</div></div>
        <div className="stat green"><div className="v">{t.completed}</div><div className="k">Completed</div></div>
        <div className="stat"><div className="v">{Math.round(t.avg_progress || 0)}%</div><div className="k">Avg Progress</div></div>
        <div className="stat green"><div className="v">{fmtCr(analytics.budget.spend)}</div><div className="k">Actual Spend</div></div>
      </div>

      <div className="two-col" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="section-title" style={{ marginTop: 0 }}>Activities by Category</div>
          {analytics.byCategory.map((c, i) => (
            <div className="hbar" key={c.category}>
              <span className="lbl" title={c.category}>{c.category}</span>
              <div className="track">
                <div className="fill" style={{ width: `${(c.count / maxCat) * 100}%`, background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
              </div>
              <span className="val">{c.count} · {fmtCr(c.budget)}</span>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="section-title" style={{ marginTop: 0 }}>Budget by Category (Cr)</div>
          {analytics.byCategory.filter((c) => c.budget > 0).map((c, i) => (
            <div className="hbar" key={c.category}>
              <span className="lbl" title={c.category}>{c.category}</span>
              <div className="track">
                <div className="fill" style={{ width: `${(c.budget / maxBudget) * 100}%`, background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
              </div>
              <span className="val">{fmtCr(c.budget)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="two-col" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="section-title" style={{ marginTop: 0 }}>Activities by SBU</div>
          {analytics.bySbu.map((c) => (
            <div className="hbar" key={c.sbu}>
              <span className="lbl" title={c.sbu}>{c.sbu}</span>
              <div className="track">
                <div className="fill" style={{ width: `${(c.count / maxSbu) * 100}%`, background: "#2f81f7" }} />
              </div>
              <span className="val">{c.count} · {fmtCr(c.budget)}</span>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="section-title" style={{ marginTop: 0 }}>Status Distribution</div>
          <div className="legend">
            {analytics.status.map((s) => (
              <span key={s.status}>
                <span className="dot" style={{ background: STATUS_COLORS[s.status] }} />
                {s.status}: {s.count}
              </span>
            ))}
          </div>
          <div className="section-title">Monthly Pipeline</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 110, marginTop: 8 }}>
            {analytics.byMonth.map((m) => (
              <div key={m.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div
                  style={{ width: "100%", maxWidth: 34, background: "#2f81f7", borderRadius: "4px 4px 0 0", height: `${(m.count / maxMonth) * 90}px`, minHeight: m.count ? 4 : 1 }}
                  title={`${monthLabel(m.month)}: ${m.count}`}
                />
                <span className="small muted" style={{ fontSize: 9 }}>{monthLabel(m.month)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="section-title"><span className="bar"></span>Activity Tracker</div>
      <div className="filters">
        <select value={fSbu} onChange={(e) => setFSbu(e.target.value)}>
          <option value="">All SBUs</option>
          {SBUS.map((s) => <option key={s.code} value={s.code}>{s.code}</option>)}
        </select>
        <select value={fCat} onChange={(e) => setFCat(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">All Status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="text" placeholder="Search activity / goal / KPI / owner…" value={fQ} onChange={(e) => setFQ(e.target.value)} />
        <span className="count">{filtered.length} activities</span>
      </div>

      <div className="tbl-scroll" style={{ maxHeight: "70vh", overflowY: "auto" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Date</th><th>SBU</th><th>Activity</th><th>Category</th>
              <th>Goal</th><th>Budget</th><th>KPI / Outcome</th><th>Owner</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td style={{ whiteSpace: "nowrap" }}>{p.activity_date}</td>
                <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{p.sbu}</td>
                <td>{p.activity}</td>
                <td><span className="cat">{p.category}</span></td>
                <td>{p.goal}</td>
                <td style={{ whiteSpace: "nowrap" }}>{fmtCr(p.budget_cr)}</td>
                <td>{p.kpi}</td>
                <td style={{ whiteSpace: "nowrap" }}>{p.responsible}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <select
                    value={p.status}
                    className={p.status}
                    style={{
                      background: STATUS_COLORS[p.status] + "22", color: STATUS_COLORS[p.status],
                      border: `1px solid ${STATUS_COLORS[p.status]}`, borderRadius: 7, padding: "3px 6px",
                      fontSize: 12, fontWeight: 600, outline: "none",
                    }}
                    onChange={(e) => patchPlan(p.id, { status: e.target.value })}
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>No activities match the filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
