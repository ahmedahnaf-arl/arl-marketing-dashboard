#!/usr/bin/env python3
"""
Create / refresh the consolidated Google Sheet that holds ALL campaign activities
(the single repository). Reads plans.json (extract output) or blobs.json (full data).

Usage:
    python sync/consolidated_sheet.py create --in plans.json   # create + populate, print id
    python sync/consolidated_sheet.py sync --in blobs.json --sheet SHEET_ID
"""
import argparse
import json
import os
import sys

import gspread

SA_PATH = os.environ.get("GOOGLE_SERVICE_ACCOUNT_PATH", "C:/Users/Hp/.google/sheets-service-account.json")
SHEET_NAME = "AKIJ Growth Calendar — Consolidated Campaigns"

HEADERS = ["Date", "End Date", "SBU", "Activity", "Category", "Goal", "KPI / Outcome",
           "Responsible", "Spend (BDT)", "Status", "Progress %", "Notes", "Source", "Created By", "Last Edited"]

END_PREFIX = "⟪end⟫"


def end_of(p):
    for line in (p.get("notes") or "").split("\n"):
        if line.startswith(END_PREFIX):
            return line[len(END_PREFIX):]
    return p.get("end_date") or ""


def plan_to_row(p):
    return [
        p.get("activity_date") or "",
        end_of(p),
        p.get("sbu") or "",
        p.get("activity") or "",
        p.get("category") or "",
        p.get("goal") or "",
        p.get("kpi") or "",
        p.get("responsible") or "",
        p.get("actual_spend") or 0,
        p.get("status") or "",
        p.get("progress") or 0,
        p.get("notes") or "",
        p.get("source") or "",
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
            print(f"using existing sheet: {sh.id}  url={sh.url}")
        else:
            sh = gc.create(SHEET_NAME)
            ws = sh.sheet1
            ws.update_title("Campaigns")
            print(f"created {SHEET_NAME}: {sh.id}  url={sh.url}")
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
