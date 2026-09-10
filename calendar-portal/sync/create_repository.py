#!/usr/bin/env python3
"""
Create the consolidated "AKIJ Campaign Repository" Google Sheet (master repo for all
SBU campaigns), seed it from plans.json, add dropdowns, and share "anyone with link".

Usage:
    python sync/create_repository.py --in sync/plans.json
"""
import argparse
import json
import os

import gspread
from google.auth.transport.requests import Request
from google.oauth2 import service_account
import requests

SA_PATH = os.environ.get("GOOGLE_SERVICE_ACCOUNT_PATH", "C:/Users/Hp/.google/sheets-service-account.json")

HEADERS = ["Date", "End Date", "SBU", "Activity", "Category", "Goal", "Budget (Cr)",
           "Actual Spend (BDT)", "KPI / Outcome", "Responsible", "Status", "Progress %", "Notes"]

SBU_LIST = ["ACCL", "AIL", "AAFL", "AAIL", "AASL", "AMPL", "AMQL", "ARMCL", "ACEL", "ALCL"]
CATEGORY_LIST = ["ATL", "BTL", "Digital", "OOH", "Research", "Promotional / Gifts",
                 "Sales & Operation", "Event / Activation", "Campaign / Promotion", "Other"]
STATUS_LIST = ["Planned", "In Progress", "Completed", "On Hold", "Cancelled"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="infile", default="sync/plans.json")
    args = ap.parse_args()

    plans = json.load(open(args.infile, encoding="utf-8"))
    gc = gspread.service_account(filename=SA_PATH)

    sh = gc.create("AKIJ Campaign Repository")
    ws = sh.sheet1
    ws.update_title("Campaigns")

    rows = [HEADERS]
    for p in plans:
        rows.append([
            p.get("activity_date") or "",
            p.get("end_date") or "",
            p.get("sbu") or "",
            p.get("activity") or "",
            p.get("category") or "",
            p.get("goal") or "",
            p.get("budget_cr") or 0,
            p.get("actual_spend") or 0,
            p.get("kpi") or "",
            p.get("responsible") or "",
            p.get("status") or "Planned",
            p.get("progress") or 0,
            p.get("notes") or "",
        ])
    ws.update(rows, value_input_option="USER_ENTERED")

    # data validation dropdowns
    def dv(col_letter, values):
        body = {
            "requests": [{
                "setDataValidation": {
                    "range": {"sheetId": ws.id, "startRowIndex": 1, "endRowIndex": 2000,
                              "startColumnIndex": col_letter, "endColumnIndex": col_letter + 1},
                    "rule": {"condition": {"type": "ONE_OF_LIST", "values": [{"userEnteredValue": v} for v in values]},
                             "showCustomUi": True, "strict": True},
                }
            }]
        }
        sh.batch_update(body)

    dv(2, SBU_LIST)      # C = SBU
    dv(4, CATEGORY_LIST)  # E = Category
    dv(10, STATUS_LIST)   # K = Status

    # share "anyone with link" as writer
    creds = service_account.Credentials.from_service_account_file(
        SA_PATH, scopes=["https://www.googleapis.com/auth/drive"])
    creds.refresh(Request())
    r = requests.post(
        f"https://www.googleapis.com/drive/v3/files/{sh.id}/permissions",
        headers={"Authorization": f"Bearer {creds.token}"},
        json={"role": "writer", "type": "anyone"},
    )
    if r.status_code in (200, 201):
        print("shared: anyone with link (writer)")
    else:
        print(f"share failed: {r.status_code} {r.text[:200]}")

    print(f"SHEET_ID={sh.id}")
    print(f"URL=https://docs.google.com/spreadsheets/d/{sh.id}/edit")
    print(f"seeded {len(plans)} rows")


if __name__ == "__main__":
    main()
