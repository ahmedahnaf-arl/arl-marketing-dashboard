"use client";

import { useState } from "react";
import { CATEGORIES, SBUS, STATUSES } from "@/lib/constants";

const EMPTY = {
  activity_date: "",
  sbu: "",
  activity: "",
  category: "",
  goal: "",
  budget_cr: "",
  kpi: "",
  responsible: "",
  status: "Planned",
  progress: 0,
  actual_spend: "",
  notes: "",
  created_by: "",
};

export default function EntryPage() {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Submission failed");
      }
      setForm(EMPTY);
      setToast("Activity added successfully ✓");
      setTimeout(() => setToast(null), 3200);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="wrap" style={{ paddingBottom: 60 }}>
      <div className="pagehead">
        <h2>Add / Update a Campaign or Activity Plan</h2>
        <p>Anyone with the link can submit. Fields marked * are required. Duplicate (date + SBU + activity) will update the existing row.</p>
      </div>

      <div className="card">
        <form onSubmit={submit} className="form-grid">
          <div className="field">
            <label className="required">Date</label>
            <input type="date" required value={form.activity_date} onChange={(e) => set("activity_date", e.target.value)} />
          </div>
          <div className="field">
            <label className="required">SBU / Business</label>
            <select required value={form.sbu} onChange={(e) => set("sbu", e.target.value)}>
              <option value="">Select SBU…</option>
              {SBUS.map((s) => <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}
            </select>
          </div>
          <div className="field full">
            <label className="required">Activity</label>
            <input required placeholder="e.g. Winter peak-season TVC + outdoor flight" value={form.activity} onChange={(e) => set("activity", e.target.value)} />
          </div>
          <div className="field">
            <label className="required">Category</label>
            <select required value={form.category} onChange={(e) => set("category", e.target.value)}>
              <option value="">Select category…</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Status</label>
            <select value={form.status} onChange={(e) => set("status", e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="field full">
            <label>Business / Marketing Goal</label>
            <textarea placeholder="What is this activity meant to achieve?" value={form.goal} onChange={(e) => set("goal", e.target.value)} />
          </div>
          <div className="field">
            <label>Budget (Cr)</label>
            <input type="number" step="0.1" min="0" placeholder="e.g. 3.5" value={form.budget_cr} onChange={(e) => set("budget_cr", e.target.value)} />
          </div>
          <div className="field">
            <label>Actual Spend (BDT)</label>
            <input type="number" step="1" min="0" placeholder="Optional" value={form.actual_spend} onChange={(e) => set("actual_spend", e.target.value)} />
          </div>
          <div className="field">
            <label>Progress %</label>
            <input type="number" min="0" max="100" value={form.progress} onChange={(e) => set("progress", e.target.value)} />
          </div>
          <div className="field">
            <label>Responsible Person</label>
            <input placeholder="e.g. Subrata Kumar Singha" value={form.responsible} onChange={(e) => set("responsible", e.target.value)} />
          </div>
          <div className="field full">
            <label>Expected Outcome / KPI</label>
            <textarea placeholder="Measurable business result, e.g. GRP >= 2,200; aided recall >=60%" value={form.kpi} onChange={(e) => set("kpi", e.target.value)} />
          </div>
          <div className="field full">
            <label>Notes / Next Action</label>
            <textarea placeholder="Optional tracker notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
          <div className="field full">
            <label>Your Name (optional)</label>
            <input placeholder="Recorded as submitter" value={form.created_by} onChange={(e) => set("created_by", e.target.value)} />
          </div>

          {error && <div className="err full">{error}</div>}

          <div className="full" style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button className="btn" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save Activity"}
            </button>
            <button className="btn ghost" type="button" onClick={() => setForm(EMPTY)}>Reset</button>
          </div>
        </form>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
