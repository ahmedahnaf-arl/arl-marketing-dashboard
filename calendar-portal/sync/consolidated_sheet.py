#!/usr/bin/env python3
"""
Create / refresh the consolidated Google Sheet that holds ALL marketing activities
(the single repository). Reads plans.json (extract) or blobs.json (full data).

Usage:
    python sync/consolidated_sheet.py create --in plans.json [--sheet SHEET_ID]
    python sync/consolidated_sheet.py sync --in blobs.json --sheet SHEET_ID
"""
import argparse
import json
import os
import sys

import gspread

SA_PATH = os.environ.get("GOOGLE_SERVICE_ACCOUNT_PATH", "C:/Users/Hp/.google/sheets-service-account.json")
SHEET_NAME = "AKIJ Growth Calendar — Consolidated Campaigns"

META_KEYS = ["end_date", "brand", "market", "incremental_budget", "expected_revenue_impact",
             "expected_romi_roas", "actual_results", "actual_revenue_impact", "actual_romi_roas",
             "learning", "next_action"]

HEADERS = ["Date", "End Date", "SBU", "Activity / Campaign", "Objective", "Brand / SKU / Product",
           "Market / Segment", "Channel / Activity", "Responsible / Agency", "Budget (Cr)",
           "Incremental (Cr)", "Expected Outcome / KPI", "Exp. Sales/Rev Impact", "Exp. ROMI/ROAS",
           "Status", "Actual Spend (BDT)", "Actual Results / KPIs", "Actual Sales Impact",
           "Actual ROMI/ROAS", "Learning / Recommendation", "Next Action", "Progress %",
           "Created By", "Last Edited"]


def meta(p):
    for line in (p.get("notes") or "").split("\n"):
        if line.startswith("⟪meta⟫"):
            try:
                j = json.loads(line[len("⟪meta⟫"):])
                return j if isinstance(j, dict) else {}
            except Exception:
                return {}
    return {}


def plan_to_row(p):
    m = meta(p)
    return [
        p.get("activity_date") or "",
        m.get("end_date") or p.get("end_date") or "",
        p.get("sbu") or "",
        p.get("activity") or "",
        p.get("goal") or "",
        m.get("brand") or "",
        m.get("market") or "",
        p.get("category") or "",
        p.get("responsible") or "",
        p.get("budget_cr") or 0,
        m.get("incremental_budget") or 0,
        p.get("kpi") or "",
        m.get("expected_revenue_impact") or "",
        m.get("expected_romi_roas") or "",
        p.get("status") or "",
        p.get("actual_spend") or 0,
        m.get("actual_results") or "",
        m.get("actual_revenue_impact") or "",
        m.get("actual_romi_roas") or "",
        m.get("learning") or "",
        m.get("next_action") or "",
        p.get("progress") or 0,
        p.get("created_by") or "",
        p.get("last_edited_by") or "",
    ]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["create", "sync"])
    ap.add_argument("--in", dest="infile", default="plans.json")
    ap.add_argument("--sheet", default=None)
    args = ap.parse_args()

    plans = json.load(open(args.infile, encoding="utf-8"))
    gc = gspread.service_account(filename=SA_PATH)

    if args.mode == "create":
        if args.sheet:
            sh = gc.open_by_key(args.sheet)
            ws = sh.sheet1
        else:
            sh = gc.create(SHEET_NAME)
            ws = sh.sheet1
            try:
                ws.update_title("Campaigns")
            except Exception:
                pass
        print(f"using sheet: {sh.id}  url={sh.url}")
    else:
        if not args.sheet:
            print("--sheet SHEET_ID required for sync", file=sys.stderr)
            sys.exit(2)
        sh = gc.open_by_key(args.sheet)
        ws = sh.sheet1

    ws.clear()
    ws.update([HEADERS] + [plan_to_row(p) for p in plans], value_input_option="USER_ENTERED")
    ws.freeze(rows=1)
    print(f"wrote {len(plans)} rows to '{ws.title}' in {sh.id}")


if __name__ == "__main__":
    main()
