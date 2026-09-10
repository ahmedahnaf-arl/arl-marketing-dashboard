#!/usr/bin/env python3
"""
Write portal-added rows back to the per-SBU Google Sheets workbooks.

Reads `blobs.json` (dumped from the portal's Netlify Blobs), finds rows added
via the portal (created_by set) that aren't yet synced, and appends them to the
matching Google Sheet. Only Google Sheets are writable (XLSX workbooks are
read-only via API).

Usage:
    python sync/write_back.py --blobs blobs.json [--ids synced_ids.json] [--dry-run]
"""
import argparse
import datetime
import json
import os
import sys

import gspread

SA_PATH = os.environ.get("GOOGLE_SERVICE_ACCOUNT_PATH", "C:/Users/Hp/.google/sheets-service-account.json")

# Only Google Sheets are writable. XLSX workbooks are skipped.
SHEET_BY_SBU = {
    "ACCL": "1tYVbRJWizuTJ_E7NMX_GORAtJrNPhyLc17zmyW1rC3s",
    "AIL": "1oZwpPSy4eQvUPb_eS89mYqA0k6C834MdqCstheg1pAw",
    "AAFL": "1jqTPE0Q_JQTgAxXt6gh18iuMRBzv7WA4KwvA98tqcA8",
}

STATUS_BACK = {
    "In Progress": "Ongoing",
    "Planned": "Planned",
    "On Hold": "On Hold",
    "Completed": "Completed",
    "Cancelled": "Cancelled",
}

# portal field -> (sheet header name, value transform)
END_PREFIX = "⟪end⟫"


def end_of(p):
    for line in (p.get("notes") or "").split("\n"):
        if line.startswith(END_PREFIX):
            return line[len(END_PREFIX):]
    return p.get("end_date")


FIELD_MAP = [
    ("Activity Start Date", lambda p: p.get("activity_date")),
    ("Activity End Date", lambda p: end_of(p)),
    ("SBU/Business", lambda p: p.get("sbu")),
    ("Activity Type", lambda p: p.get("activity")),
    ("Category", lambda p: p.get("category")),
    ("Business/Marketing Goal", lambda p: p.get("goal")),
    ("Expected Outcome/KPI", lambda p: p.get("kpi")),
    ("Responsible Person", lambda p: p.get("responsible")),
    ("Actual Expense (BDT)", lambda p: p.get("actual_spend") or 0),
    ("Execution Status", lambda p: STATUS_BACK.get(p.get("status"), "Planned")),
    ("Remarks", lambda p: (p.get("notes") or "")),
]


def header_map(ws):
    vals = ws.row_values(1)
    return {h.strip().lower(): i + 1 for i, h in enumerate(vals) if str(h).strip()}


def build_row(p, hmap):
    row = [""] * (max(hmap.values()) if hmap else 25)
    for sheet_name, fn in FIELD_MAP:
        key = sheet_name.strip().lower()
        if key in hmap:
            val = fn(p)
            row[hmap[key] - 1] = "" if val is None else val
    return row


def find_tracker_sheet(sh):
    for ws in sh.worksheets():
        t = ws.title.strip().lower()
        if t in ("master sheet", "spend summary"):
            continue
        return ws
    return sh.worksheet(sh.worksheets()[0].title)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--blobs", default="blobs.json")
    ap.add_argument("--ids", default="synced_ids.json")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    rows = json.load(open(args.blobs, encoding="utf-8"))
    pending = [p for p in rows if (p.get("created_by") and not p.get("synced_to_sheet"))]
    if not pending:
        print("No pending portal rows to sync.")
        if not args.dry_run:
            json.dump([], open(args.ids, "w"))
        return

    gc = gspread.service_account(filename=SA_PATH)
    synced = []
    skipped = []

    for p in pending:
        sbu = p.get("sbu")
        sheet_id = SHEET_BY_SBU.get(sbu)
        if not sheet_id:
            skipped.append((p["id"], sbu, "no writable sheet (XLSX or unmapped)"))
            continue
        try:
            sh = gc.open_by_key(sheet_id)
            ws = find_tracker_sheet(sh)
            hmap = header_map(ws)
            row = build_row(p, hmap)
            if not args.dry_run:
                ws.append_row(row, value_input_option="USER_ENTERED")
            synced.append(p["id"])
            print(f"[ok] {sbu}: appended '{p.get('activity','')[:50]}'")
        except Exception as e:
            skipped.append((p["id"], sbu, str(e)))
            print(f"[warn] {sbu}: {e}", file=sys.stderr)

    if not args.dry_run:
        json.dump(synced, open(args.ids, "w"))
    print(f"\nSynced: {len(synced)} | Skipped: {len(skipped)}")
    for sid, sbu, reason in skipped:
        print(f"  - {sbu}: {reason}")


if __name__ == "__main__":
    main()
