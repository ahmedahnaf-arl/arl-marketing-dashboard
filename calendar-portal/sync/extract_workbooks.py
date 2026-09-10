#!/usr/bin/env python3
"""
Sync AKIJ per-SBU Marketing Activities workbooks -> portal plans schema.

Reads Google Sheets (via service account) and XLSX (downloaded from Drive),
normalizes the "Campaign Tracker" columns into the portal record shape, and
writes a single `plans.json`.

Usage:
    python sync/extract_workbooks.py [--out plans.json] [--drive-token TOKEN]
"""
import argparse
import datetime
import io
import json
import os
import re
import sys

import gspread
import requests
from openpyxl import load_workbook

SA_PATH = os.environ.get("GOOGLE_SERVICE_ACCOUNT_PATH", "C:/Users/Hp/.google/sheets-service-account.json")
DRIVE_EXPORT = "https://drive.google.com/uc?id={file_id}&export=download"

# ----------------------------------------------------------------------------
# Workbook registry: (kind, id, sbu_code, sbu_name)
# ----------------------------------------------------------------------------
WORKBOOKS = [
    ("sheets", "1tYVbRJWizuTJ_E7NMX_GORAtJrNPhyLc17zmyW1rC3s", "ACCL", "Akij Cement Company Ltd."),
    ("sheets", "1oZwpPSy4eQvUPb_eS89mYqA0k6C834MdqCstheg1pAw", "AIL", "Akij Ispat Ltd."),
    ("sheets", "1jqTPE0Q_JQTgAxXt6gh18iuMRBzv7WA4KwvA98tqcA8", "AAFL", "Akij Agro Feed Ltd."),
    ("xlsx", "1cmSUippKmOcXBJ5cw6cM-ctBamacmF_o", "AAIL", "Akij Automobile Industries Ltd."),
    ("xlsx", "1ClrT0w_HfdQxNXnaHNov8TZxINavXKd_", "AASL", "Akij Air Service Ltd."),
    ("xlsx", "1p2fq3j_J9l9-_tLlPBQweV0n4fygEGwV", "AMPL", "Akij Mediplex Ltd."),
    ("xlsx", "1duINPF8CSfwUh8Sx0__LhHNO5gLhHn9e", "AMQL", "Akij Mediquip Ltd."),
    ("xlsx", "1rxp_JV9fQYzQ9OeW13ymsalVTOR1Y2FS", "ARMCL", "Akij Ready Mix Concrete Ltd."),
    ("xlsx", "1233U5WUWe4k4cen4NoQrjT8hUKSAfQOM", "ACEL", "Akij Consumer Electronics Ltd. (ORCA)"),
]
PHARMACY_SHORTCUT_ID = "1DskLYlK-GNuLoolewPLsx7Eb3az84y2b"

STATUS_MAP = {
    "ongoing": "In Progress",
    "in progress": "In Progress",
    "planned": "Planned",
    "on hold": "On Hold",
    "completed": "Completed",
    "done": "Completed",
    "approved": "Planned",
    "": "Planned",
    "n/a": "Planned",
}

# sheets to skip (template/lookup sheets present in every workbook)
SKIP_SHEETS = {"master sheet", "spend summary"}


def norm_header(h):
    return re.sub(r"\s+", " ", (h or "")).strip().lower()


def parse_date(v, month_label=None):
    """Best-effort normalize a start date to YYYY-MM-DD. Falls back to month_label."""
    if v is None:
        return fallback_month(month_label)
    if isinstance(v, datetime.datetime):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, datetime.date):
        return v.strftime("%Y-%m-%d")
    s = str(v).strip()
    if not s or s.lower() in ("n/a", "none"):
        return fallback_month(month_label)
    # YYYY-MM-DD
    m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})", s)
    if m:
        return f"{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    # DD/MM/YYYY or MM/DD/YYYY
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", s)
    if m:
        a, b, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if a > 12:  # D/M/Y
            return f"{y:04d}-{b:02d}-{a:02d}"
        elif b > 12:  # M/D/Y
            return f"{y:04d}-{a:02d}-{b:02d}"
        else:
            return f"{y:04d}-{a:02d}-{b:02d}"  # assume M/D/Y
    return fallback_month(month_label)


def fallback_month(month_label):
    if month_label:
        mm = re.match(r"^([A-Za-z]{3})-(\d{2})$", str(month_label).strip())
        if mm:
            months = {"jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
                      "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12}
            mo = months.get(mm.group(1).lower())
            yr = 2000 + int(mm.group(2))
            if mo:
                return f"{yr:04d}-{mo:02d}-01"
    return "2026-09-01"


def num(v):
    if v is None or v == "":
        return 0
    try:
        return float(str(v).replace(",", "").strip())
    except (ValueError, TypeError):
        return 0


def normalize_category(raw):
    c = str(raw or "").strip().lower()
    if not c:
        return "Other"
    if any(k in c for k in ["social", "google", "sms", "whatsapp", "reels", "content", "digital", "dynamic", "static", "contingency", "facebook", "instagram", "youtube", "offer launch", "boosting", "product feature", "teaser"]):
        return "Digital"
    if any(k in c for k in ["ooh", "bill board", "billboard", "vehicle", "rickshaw", "cycle", "sign", "lightbox", "hoarding", "branding"]):
        return "OOH"
    if any(k in c for k in ["research", "study", "survey", "insight"]):
        return "Research"
    if any(k in c for k in ["gift", "printing", "print", "posm", "leaflet", "promotional", "merchandise", "t-shirt", "slip pad", "plate", "tiffin", "coffee mug"]):
        return "Promotional / Gifts"
    if any(k in c for k in ["event", "expo", "fair", "caravan", "roadshow", "store launch", "activation", "sponsorship"]):
        return "Event / Activation"
    if any(k in c for k in ["sales", "operation", "trade", "distribution", "dealer", "retail meet"]):
        return "Sales & Operation"
    if any(k in c for k in ["awareness", "campaign", "contest", "discount", "offer", "promotion", "test"]):
        return "Campaign / Promotion"
    if any(k in c for k in ["atl", "tvc", "radio", "press", "magazine", "newspaper", "tv", "channel"]):
        return "ATL"
    if any(k in c for k in ["btl", "ground", "on-ground"]):
        return "BTL"
    return "Other"


def sbu_code(raw_sbu, default_code):
    r = str(raw_sbu or "").strip().lower()
    mapping = {
        "sany forklift": "AAIL", "benzol": "AAIL", "tyre": "AAIL", "aail": "AAIL",
        "ready-mix": "ARMCL", "ready mix": "ARMCL", "readymix": "ARMCL",
        "mediplex": "AMPL", "medquip": "AMQL", "mediquip": "AMQL",
        "air": "AASL", "orca": "ACEL", "acel": "ACEL",
        "pharmacy": "ALCL", "lifecare": "ALCL", "aafl": "AAFL",
        "accl": "ACCL", "ail": "AIL",
    }
    best = None
    for k, code in mapping.items():
        if k in r and (best is None or len(k) > len(best[0])):
            best = (k, code)
    return best[1] if best else default_code


def row_to_plan(row, col, default_sbu_code):
    def get(name):
        i = col.get(norm_header(name))
        return row[i] if i is not None and i < len(row) else None

    campaign = (get("Campaign/Activity Name") or "").strip()
    activity_type = (get("Activity Type") or "").strip()
    activity = activity_type or campaign
    if campaign and activity_type and campaign.lower() != activity_type.lower():
        activity = f"{campaign} — {activity_type}"

    raw_sbu = get("SBU/Business") or ""
    start_date = parse_date(get("Activity Start Date"), get("Month"))
    status_raw = (get("Execution Status") or "").strip().lower()
    status = STATUS_MAP.get(status_raw, "Planned")
    progress = 100 if status == "Completed" else (50 if status == "In Progress" else 0)

    # stash approval status into notes for fidelity
    approval = (get("Approval Status") or "").strip()
    remarks = (get("Remarks") or "").strip()
    notes_parts = []
    if approval:
        notes_parts.append(f"[Approval: {approval}]")
    if remarks:
        notes_parts.append(remarks)
    notes = " | ".join(notes_parts) or None

    return {
        "activity_date": start_date,
        "end_date": parse_date(get("Activity End Date")),
        "sbu": sbu_code(raw_sbu, default_sbu_code),
        "activity": activity,
        "category": normalize_category(get("Category")),
        "goal": (get("Business/Marketing Goal") or "").strip() or None,
        "budget_cr": 0,
        "kpi": (get("Expected Outcome/KPI") or "").strip() or None,
        "responsible": (get("Responsible Person") or "").strip() or None,
        "status": status,
        "progress": progress,
        "actual_spend": num(get("Actual Expense (BDT)")),
        "notes": notes,
        "created_by": None,
        "last_edited_by": None,
        "source": "workbook",
    }


def read_sheets(gc, sheet_id):
    sh = gc.open_by_key(sheet_id)
    rows = []
    for ws in sh.worksheets():
        if norm_header(ws.title) in SKIP_SHEETS:
            continue
        rows.extend(read_grid(ws.get_all_values()))
    return rows


def read_grid(grid):
    """Convert a 2D grid (header + rows) into a list of {name->value} dicts."""
    if not grid:
        return []
    header = [norm_header(c) for c in grid[0]]
    col = {h: i for i, h in enumerate(header)}
    out = []
    for r in grid[1:]:
        if not any(str(c).strip() for c in r):
            continue
        out.append((r, col))
    return out


def read_xlsx(path):
    wb = load_workbook(path, data_only=True)
    rows = []
    for ws in wb.worksheets:
        if norm_header(ws.title) in SKIP_SHEETS:
            continue
        grid = [[ws.cell(row=r, column=c).value for c in range(1, ws.max_column + 1)] for r in range(1, ws.max_row + 1)]
        rows.extend(read_grid(grid))
    return rows


def resolve_shortcut(gc, shortcut_id):
    """Resolve a Drive shortcut to its target Google Sheet id."""
    try:
        from google.auth.transport.requests import Request
        from google.oauth2 import service_account
        creds = service_account.Credentials.from_service_account_file(
            SA_PATH, scopes=["https://www.googleapis.com/auth/drive.readonly"]
        )
        creds.refresh(Request())
        r = requests.get(
            f"https://www.googleapis.com/drive/v3/files/{shortcut_id}?fields=shortcutDetails",
            headers={"Authorization": f"Bearer {creds.token}"},
        )
        data = r.json()
        return data.get("shortcutDetails", {}).get("targetId")
    except Exception:
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="plans.json")
    ap.add_argument("--drive-token", default=None)
    args = ap.parse_args()

    gc = gspread.service_account(filename=SA_PATH)
    plans = []

    for kind, fid, code, name in WORKBOOKS:
        try:
            if kind == "sheets":
                rows = read_sheets(gc, fid)
            else:
                url = DRIVE_EXPORT.format(file_id=fid)
                r = requests.get(url, timeout=60)
                r.raise_for_status()
                rows = read_xlsx(io.BytesIO(r.content))
            for row, col in rows:
                p = row_to_plan(row, col, code)
                if p["activity"]:
                    plans.append(p)
            print(f"[ok] {code}: {len([1 for _ in rows if _])} rows -> {len([p for p in plans if p['sbu']==code])} plans")
        except Exception as e:
            print(f"[warn] {code} failed: {e}", file=sys.stderr)

    # Pharmacy shortcut -> LifeCare (ALCL)
    try:
        target = resolve_shortcut(gc, PHARMACY_SHORTCUT_ID)
        if target:
            rows = read_sheets(gc, target)
            for row, col in rows:
                p = row_to_plan(row, col, "ALCL")
                if p["activity"]:
                    plans.append(p)
            print(f"[ok] Pharmacy shortcut -> ALCL")
    except Exception as e:
        print(f"[warn] Pharmacy shortcut failed: {e}", file=sys.stderr)

    # dedup by (date, sbu, activity)
    seen = set()
    unique = []
    for p in plans:
        key = (p["activity_date"], p["sbu"], p["activity"])
        if key in seen:
            continue
        seen.add(key)
        p["id"] = f"wb-{len(unique)}"
        unique.append(p)

    unique.sort(key=lambda p: (p["activity_date"], p["sbu"]))
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(unique, f, ensure_ascii=False, indent=1)
    print(f"\nTotal plans: {len(unique)} written to {args.out}")


if __name__ == "__main__":
    main()
