"""
import_external.py — parse the AEL price & trade-offer workbook into JSON.

Source: "Copy of Competitor's Comparison - Price & Trade Offer.xlsx"
        (AEL current vs proposed price master + 13 competitor brands + Sep/Oct movement)

Run whenever the workbook is updated:
    python import_external.py --file "C:\\path\\to\\workbook.xlsx"
Writes data/external_price_master.json
"""
import argparse
import json
import os
import sys
from datetime import datetime

import openpyxl

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "data")
DEFAULT = os.path.join(ROOT, "external", "competitor_price_master.xlsx")

BRANDS = ["Fresh", "ACI Pure/Aroma", "Sunshine", "Teer", "Pran", "Chashi/Radhuni",
          "Pusti", "Bashundhara", "Rupchanda", "Molla", "No. 1", "Kulson", "Ispahani Mirzapore"]

# 1-based column numbers from the sheet header
COL = {
    "code": 2, "name": 3, "bag": 4, "cat": 5,
    "cur_dp": 6, "cur_tp": 7, "cur_offer": 8, "cur_edp": 9, "cur_etp": 10,
    "prop_dp": 11, "prop_tp": 12, "prop_mrp": 13, "prop_offer": 14, "prop_edp": 15, "prop_etp": 16,
    "prim_sep": 18, "prim_oct": 19, "sec_sep": 20, "sec_oct": 21, "out_sep": 22, "out_oct": 23,
}
COMP_FIRST = 24          # column 24 = first brand's DP
COMP_WIDTH = 6           # DP, TP, MRP, Trade Offer, EDP, ETP


def num(v):
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def text(v):
    if v is None:
        return None
    s = str(v).replace("\n", " ").strip()
    return s or None


def code_of(v):
    if v is None:
        return None
    s = str(v).strip()
    if s.endswith(".0"):
        s = s[:-2]
    return s if s.isdigit() else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", default=DEFAULT)
    args = ap.parse_args()

    if not os.path.exists(args.file):
        print("workbook not found: %s" % args.file, file=sys.stderr)
        sys.exit(2)

    wb = openpyxl.load_workbook(args.file, data_only=True)
    ws = wb["Masterfile Price"]
    rows = list(ws.iter_rows(min_row=4, values_only=True))

    out = []
    for r in rows:
        def g(key):
            idx = COL[key] - 1
            return r[idx] if idx < len(r) else None

        code = code_of(g("code"))
        if not code:
            continue

        cur = {"dp": num(g("cur_dp")), "tp": num(g("cur_tp")),
               "offer": text(g("cur_offer")), "edp": num(g("cur_edp")), "etp": num(g("cur_etp"))}
        prop = {"dp": num(g("prop_dp")), "tp": num(g("prop_tp")), "mrp": num(g("prop_mrp")),
                "offer": text(g("prop_offer")), "edp": num(g("prop_edp")), "etp": num(g("prop_etp"))}
        vol = {"primSep": num(g("prim_sep")), "primOct": num(g("prim_oct")),
               "secSep": num(g("sec_sep")), "secOct": num(g("sec_oct")),
               "outSep": num(g("out_sep")), "outOct": num(g("out_oct"))}

        comp = []
        for bi, brand in enumerate(BRANDS):
            base = (COMP_FIRST - 1) + bi * COMP_WIDTH
            if base >= len(r):
                break
            dp = num(r[base]); tp = num(r[base + 1]); mrp = num(r[base + 2])
            offer = text(r[base + 3]); edp = num(r[base + 4]); etp = num(r[base + 5])
            if all(v is None for v in (dp, tp, mrp, offer, edp, etp)):
                continue
            comp.append({"b": brand, "dp": dp, "tp": tp, "mrp": mrp,
                         "o": offer, "edp": edp, "etp": etp})

        out.append({
            "c": code, "n": text(g("name")), "cat": text(g("cat")), "bag": num(g("bag")),
            "cur": cur, "prop": prop, "vol": vol, "comp": comp,
        })

    brands = sorted({c["b"] for row in out for c in row["comp"]})
    payload = {
        "source": os.path.basename(args.file),
        "imported": datetime.now().strftime("%Y-%m-%d"),
        "brands": brands,
        "rows": out,
    }
    os.makedirs(DATA, exist_ok=True)
    ext_dir = os.path.join(ROOT, "external")
    os.makedirs(ext_dir, exist_ok=True)
    for path in (os.path.join(DATA, "external_price_master.json"),
                 os.path.join(ext_dir, "price_master.json")):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, separators=(",", ":"), ensure_ascii=False)

    priced = sum(1 for r in out if r["comp"])
    print("rows %d · with competitor prices %d · brands %d" % (len(out), priced, len(brands)))
    print("wrote data/external_price_master.json and external/price_master.json")


if __name__ == "__main__":
    main()
