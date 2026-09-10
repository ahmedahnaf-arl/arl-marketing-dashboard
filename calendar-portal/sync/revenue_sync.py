#!/usr/bin/env python3
"""
Fetch channel-wise revenue per SBU from the DWH (oms schema) and cache to revenue.json.

Run in the sync GitHub Action (has DWH_SERVER/DWH_USER/DWH_PASSWORD secrets).

Usage:
    python sync/revenue_sync.py --out revenue.json [--days 90]
"""
import argparse
import json
import os
import sys

SBU_CODES = ["ACCL", "AIL", "AAFL", "AAIL", "AASL", "AMPL", "AMQL", "ARMCL", "ACEL", "ALCL"]

QUERY = """
SELECT b.strBusinessUnitCode AS sbu,
       h.strDistributionChannelName AS channel,
       SUM(r.numNetValue) AS revenue,
       SUM(r.numOrderQuantity) AS qty,
       COUNT(DISTINCT h.intSalesOrderId) AS orders
FROM oms.tblSalesOrderHeaderArc h
JOIN oms.tblSalesOrderRowArc r ON r.intSalesOrderId = h.intSalesOrderId
JOIN dco.tblbusinessunitArc b ON b.intBusinessUnitId = h.intBusinessUnitId
WHERE h.isActive = 1
  AND h.dteSalesOrderDate >= DATEADD(DAY, -{days}, GETDATE())
  AND b.strBusinessUnitCode IN ({codes})
GROUP BY b.strBusinessUnitCode, h.strDistributionChannelName
ORDER BY b.strBusinessUnitCode, revenue DESC
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="revenue.json")
    ap.add_argument("--days", type=int, default=90)
    args = ap.parse_args()

    server = os.environ.get("DWH_SERVER")
    user = os.environ.get("DWH_USER")
    password = os.environ.get("DWH_PASSWORD")
    if not (server and user and password):
        print("DWH_SERVER/DWH_USER/DWH_PASSWORD env vars required.", file=sys.stderr)
        sys.exit(2)

    try:
        import pymssql
    except ImportError:
        print("pymssql not installed.", file=sys.stderr)
        sys.exit(2)

    codes = ",".join(f"'{c}'" for c in SBU_CODES)
    sql = QUERY.format(days=args.days, codes=codes)

    try:
        conn = pymssql.connect(server=server, user=user, password=password, database="DWH")
        cursor = conn.cursor(as_dict=True)
        cursor.execute(sql)
        rows = cursor.fetchall()
        conn.close()
    except Exception as e:
        print(f"DWH query failed: {e}", file=sys.stderr)
        sys.exit(1)

    for r in rows:
        r["revenue"] = float(r["revenue"] or 0)
        r["qty"] = float(r["qty"] or 0)
        r["orders"] = int(r["orders"] or 0)

    out = {"as_of_days": args.days, "rows": rows}
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f)
    print(f"revenue cached: {len(rows)} channel rows -> {args.out}")


if __name__ == "__main__":
    main()
