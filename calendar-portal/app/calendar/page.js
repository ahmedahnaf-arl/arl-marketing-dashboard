"use client";

import { useEffect, useMemo, useState } from "react";
import { CATEGORIES, SBUS, STATUS_COLORS } from "@/lib/constants";

const MONTHS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];

function label(ym) {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[m - 1]}-${String(y).slice(2)}`;
}

export default function CalendarPage() {
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState(null);
  const [fSbu, setFSbu] = useState("");
  const [fCat, setFCat] = useState("");

  useEffect(() => {
    fetch("/api/plans")
      .then((r) => (r.ok ? r.json() : Promise.reject("Failed to load")))
      .then((j) => setPlans(j.data))
      .catch((e) => setError(e.message));
  }, []);

  const groups = useMemo(() => {
    const map = {};
    for (const p of plans) {
      if (fSbu && p.sbu !== fSbu) continue;
      if (fCat && p.category !== fCat) continue;
      const ym = p.activity_date.slice(0, 7);
      (map[ym] ||= []).push(p);
    }
    return Object.keys(map).sort().map((ym) => ({ ym, items: map[ym].sort((a, b) => a.activity_date.localeCompare(b.activity_date)) }));
  }, [plans, fSbu, fCat]);

  if (error) {
    return (
      <div className="wrap"><div className="pagehead"><p className="err">Error: {error}</p></div></div>
    );
  }

  return (
    <div className="wrap" style={{ paddingBottom: 60 }}>
      <div className="pagehead">
        <h2>Monthly Calendar</h2>
        <p>Activities plotted by scheduled month (FY 2026-27). Filter to focus on an SBU or category.</p>
      </div>

      <div className="filters">
        <select value={fSbu} onChange={(e) => setFSbu(e.target.value)}>
          <option value="">All SBUs</option>
          {SBUS.map((s) => <option key={s.code} value={s.code}>{s.code}</option>)}
        </select>
        <select value={fCat} onChange={(e) => setFCat(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="count">{plans.filter((p) => (!fSbu || p.sbu === fSbu) && (!fCat || p.category === fCat)).length} activities</span>
      </div>

      <div className="cal-grid">
        {groups.map((g) => (
          <div className="month-card" key={g.ym}>
            <h4>{label(g.ym)} <span className="muted small">({g.items.length})</span></h4>
            {g.items.map((p) => (
              <div className="month-item" key={p.id} style={{ borderLeftColor: STATUS_COLORS[p.status] || "#2f81f7" }}>
                <div className="sbu">{p.sbu}</div>
                <div className="t">{p.activity}</div>
                <div className="c">{p.category} · {p.status}</div>
              </div>
            ))}
          </div>
        ))}
        {groups.length === 0 && <div className="card muted" style={{ gridColumn: "1 / -1" }}>No activities match the filter.</div>}
      </div>
    </div>
  );
}
