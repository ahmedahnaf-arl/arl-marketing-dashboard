"""
refresh.py -- pull the AEL price/volume dataset from the live ERP gateway and
rebuild data/*.json for build.js.

Auth: ERP_API_KEY + ERP_DEVICE_ID (same secrets the flash-report workflow uses).
Runs the same read-only SQL used to build the report; no DWH dependency.

Usage:
    python refresh.py --probe        # one month + row counts, no writes
    python refresh.py                # incremental (missing months + last 2)
    python refresh.py --full         # rebuild the whole panel
"""
import argparse
import csv
import io
import json
import os
import sys
from datetime import date

import time

import requests

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "data")
GATEWAY_URL = os.environ.get("ERP_GATEWAY_URL", "https://enterprise-api-gateway.ibos.agency/mcp")
API_KEY = os.environ.get("ERP_API_KEY", "")
DEVICE_ID = os.environ.get("ERP_DEVICE_ID", "")
if not API_KEY or not DEVICE_ID:
    print("ERP_API_KEY and ERP_DEVICE_ID must be set", file=sys.stderr)
    sys.exit(2)

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "X-Device-Id": DEVICE_ID,
    "Content-Type": "application/json",
}

CATEGORY_SHEET = os.environ.get(
    "AEL_CATEGORY_SHEET", "1mXoEEQB6_tJfS485mQPA_lHJKG79M9yYMc_f6_7AryQ"
)


def erp(sql, limit=500, max_bytes=3500000, attempts=6):
    """Run read-only SQL through the gateway; return list[dict]. Retries transient errors."""
    last = None
    for attempt in range(1, attempts + 1):
        try:
            return _erp_once(sql, limit, max_bytes)
        except Exception as e:  # noqa: BLE001
            msg = str(e)
            transient = ("Connection is busy" in msg or "timeout" in msg.lower()
                         or "temporarily unavailable" in msg.lower() or "502" in msg or "503" in msg)
            if not transient or attempt == attempts:
                raise
            last = e
            time.sleep(min(30, 3 * attempt))
    raise last


def _erp_once(sql, limit, max_bytes):
    """Single gateway call."""
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": "execute_readonly_query",
            "arguments": {"sql": sql, "limit": limit, "max_bytes": max_bytes, "format": "rows"},
        },
    }
    r = requests.post(GATEWAY_URL, headers=HEADERS, json=payload, timeout=240)
    r.raise_for_status()
    outer = r.json()
    if "result" not in outer:
        raise RuntimeError(f"gateway error: {outer}")
    content = outer["result"].get("content", [])
    if not content:
        return []
    inner = json.loads(content[0]["text"])
    if "error" in inner:
        raise RuntimeError(f"ERP query error: {inner.get('message') or inner['error']}")
    if inner.get("truncated"):
        raise RuntimeError("response was truncated -- split the query (500-row cap)")
    return inner.get("rows", [])


def cfg():
    with open(os.path.join(ROOT, "config.json"), encoding="utf-8-sig") as f:
        return json.load(f)


def months_between(a, b):
    out = []
    y, m = a
    while (y, m) <= b:
        out.append(f"{y:04d}-{m:02d}")
        m += 1
        if m > 12:
            m = 1
            y += 1
    return out


def next_month(ym):
    y, m = map(int, ym.split("-"))
    m += 1
    if m > 12:
        m, y = 1, y + 1
    return f"{y:04d}-{m:02d}"


def panel_month(bu, ym):
    nxt = next_month(ym)
    sql = f"""SELECT r.strItemCode AS c, MIN(r.strItemName) AS n,
       SUM(r.numOrderQuantity) AS q, SUM(r.numOrderValue) AS g,
       SUM(r.numNetValue) AS v, SUM(r.numDiscountValue) AS d,
       SUM(CASE WHEN r.isFreeItem=1 THEN r.numOrderQuantity ELSE 0 END) AS f
FROM oms.tblsalesorderrow r
WHERE r.intBusinessUnitId = {bu}
  AND EXISTS (SELECT 1 FROM oms.tblSalesOrderHeader h
              WHERE h.intSalesOrderId = r.intSalesOrderId AND h.isActive = 1
                AND h.dteSalesOrderDate >= '{ym}-01' AND h.dteSalesOrderDate < '{nxt}-01')
GROUP BY r.strItemCode
ORDER BY r.strItemCode"""
    return erp(sql)


CHANNELS = [71, 70, 67, 146, 145, 72, 68, 96]


def channel_month(bu, ym):
    nxt = next_month(ym)
    parts = []
    for ch in CHANNELS:
        parts.append(f"""SELECT {ch} AS ch, r.strItemCode AS c,
       SUM(r.numOrderQuantity) AS q, SUM(r.numNetValue) AS v
FROM oms.tblsalesorderrow r
WHERE r.intBusinessUnitId = {bu}
  AND EXISTS (SELECT 1 FROM oms.tblSalesOrderHeader h
              WHERE h.intSalesOrderId = r.intSalesOrderId AND h.isActive = 1
                AND h.intDistributionChannelId = {ch}
                AND h.dteSalesOrderDate >= '{ym}-01' AND h.dteSalesOrderDate < '{nxt}-01')
GROUP BY r.strItemCode""")
    parts.append(f"""SELECT 0 AS ch, r.strItemCode AS c,
       SUM(r.numOrderQuantity) AS q, SUM(r.numNetValue) AS v
FROM oms.tblsalesorderrow r
WHERE r.intBusinessUnitId = {bu}
  AND EXISTS (SELECT 1 FROM oms.tblSalesOrderHeader h
              WHERE h.intSalesOrderId = r.intSalesOrderId AND h.isActive = 1
                AND h.intDistributionChannelId IN (69,92,93,185,73,183,74)
                AND h.dteSalesOrderDate >= '{ym}-01' AND h.dteSalesOrderDate < '{nxt}-01')
GROUP BY r.strItemCode""")
    return erp("\nUNION ALL\n".join(parts) + "\nORDER BY ch, c")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--full", action="store_true")
    ap.add_argument("--probe", action="store_true")
    args = ap.parse_args()

    c = cfg()
    bu = c["buCode"]
    os.makedirs(DATA, exist_ok=True)

    scope = erp(f"SELECT MIN(dteSalesOrderDate) AS mn, MAX(dteSalesOrderDate) AS mx "
                f"FROM oms.tblSalesOrderHeader WHERE intBusinessUnitId = {bu} AND isActive = 1")[0]
    first = str(scope["mn"])[:7]
    last = str(scope["mx"])[:7]
    # build up to the last COMPLETE month
    today = date.today()
    last_complete = (today.year, today.month - 1) if today.month > 1 else (today.year - 1, 12)
    all_months = [m for m in months_between(tuple(map(int, first.split("-"))), last_complete)]
    print(f"scope {first} -> {last} · building {len(all_months)} months ({all_months[0]}..{all_months[-1]})")

    if args.probe:
        ym = all_months[-2]
        rows = panel_month(bu, ym)
        ch = channel_month(bu, ym)
        print(f"probe {ym}: panel rows={len(rows)} channel rows={len(ch)}")
        print("sample:", rows[0] if rows else None)
        return

    # ---- panel (incremental) ----
    panel_path = os.path.join(DATA, "panel_full.json")
    existing = {}
    if os.path.exists(panel_path) and not args.full:
        old = json.load(open(panel_path, encoding="utf-8-sig"))
        for r in old["rows"]:
            existing.setdefault(r["m"], []).append(r)
        print(f"loaded {len(old['rows'])} existing rows across {len(existing)} months")

    refresh_months = set(all_months[-2:])
    panel = []
    for ym in all_months:
        if ym in existing and ym not in refresh_months:
            panel.extend(existing[ym])
            continue
        rows = panel_month(bu, ym)
        for r in rows:
            panel.append({"m": ym, "c": r["c"], "n": r.get("n") or r["c"],
                          "q": float(r["q"] or 0), "g": float(r["g"] or 0),
                          "v": float(r["v"] or 0), "d": float(r["d"] or 0), "f": float(r["f"] or 0)})
        print(f"  panel {ym}: {len(rows)} lines")
    json.dump({"months": all_months, "rows": panel},
              open(panel_path, "w", encoding="utf-8"), separators=(",", ":"))

    # ---- channel (last 24 months) ----
    ch_months = all_months[-24:]
    crows = []
    for ym in ch_months:
        for r in channel_month(bu, ym):
            crows.append({"m": ym, "ch": int(r["ch"]), "c": r["c"],
                          "q": float(r["q"] or 0), "v": float(r["v"] or 0)})
    json.dump({"months": ch_months, "rows": crows},
              open(os.path.join(DATA, "channel_full.json"), "w", encoding="utf-8"), separators=(",", ":"))
    print(f"channel: {len(crows)} rows across {len(ch_months)} months")

    # ---- declared prices ----
    snap = erp(f"""SELECT strItemCode, strItemName, strDistributionChannelName,
       numDPRate, numTPRate, numMrpRate, isActive, dteLastActionDateTime
FROM rtm.tblRetailPrice WHERE intBusinessUnitId = {bu}
ORDER BY strItemCode, strDistributionChannelName""")
    json.dump({"rows": snap}, open(os.path.join(DATA, "snapshot_raw.json"), "w", encoding="utf-8"), separators=(",", ":"))

    hist = erp(f"""SELECT strItemCode, strItemName, strDistributionChannelName,
       numDPRate, numTPRate, numMrpRate,
       MIN(dteLogEntryDate) AS f, MAX(dteLogEntryDate) AS l, COUNT(*) AS n
FROM rtm.tblRetailPriceLog WHERE intBusinessUnitId = {bu}
GROUP BY strItemCode, strItemName, strDistributionChannelName, numDPRate, numTPRate, numMrpRate
ORDER BY strItemCode, f""")
    hrows = [[r["strItemCode"], r["strItemName"], r["strDistributionChannelName"],
              r["numDPRate"], r["numTPRate"], r["numMrpRate"],
              str(r["f"]), str(r["l"]), r["n"]] for r in hist]
    json.dump({"rows": hrows}, open(os.path.join(DATA, "price_history_raw.json"), "w", encoding="utf-8"), separators=(",", ":"))

    for tag, cond in (("1", "i.strItemCode < '1442'"), ("2", "i.strItemCode >= '1442'")):
        grid = erp(f"""SELECT p.intConditionReffId AS ch, i.strItemCode AS c, i.strItemName AS n,
       p.numPrice AS pr, MIN(p.dteStartDate) AS f, MAX(p.dteEndDate) AS l, COUNT(*) AS e
FROM itm.tblPriceSetup p JOIN itm.tblItem i ON i.intItemId = p.intItemId
WHERE p.intBusinessUnitId = {bu} AND p.intConditionReffId IN (70,71) AND p.isActive = 1 AND {cond}
GROUP BY p.intConditionReffId, i.strItemCode, i.strItemName, p.numPrice
ORDER BY c, ch, f""")
        json.dump({"rows": grid}, open(os.path.join(DATA, f"price_setup_raw_{tag}.json"), "w", encoding="utf-8"), separators=(",", ":"))
    print(f"prices: snapshot={len(snap)} history={len(hrows)}")

    # ---- competition ----
    mkt = erp(f"""SELECT LEFT(CONVERT(varchar(7), h.dteDate, 120), 7) AS ym, p.strGroup AS g,
       p.strProductSKU AS sku, COUNT(DISTINCT p.strProductBrand) AS brands,
       AVG(r.numMRP) AS mrp, AVG(r.numDP) AS dp, AVG(r.numTP) AS tp
FROM oms.tblCompetitorPriceRow r
JOIN oms.tblCompetitorPriceHeader h ON h.intCompetitorPriceHeaderId = r.intCompetitorPriceHeaderId
JOIN oms.tblCompetitorProduct p ON p.intCompetitorProductId = r.intCompetitorProductId
WHERE h.intBusinessUnitId = {bu} AND r.isActive = 1
  AND p.strProductSKU NOT LIKE '%50 KG%' AND (r.numMRP > 0 OR r.numDP > 0)
GROUP BY LEFT(CONVERT(varchar(7), h.dteDate, 120), 7), p.strGroup, p.strProductSKU
ORDER BY sku, ym""")
    json.dump({"rows": mkt}, open(os.path.join(DATA, "competitor_market.json"), "w", encoding="utf-8"), separators=(",", ":"))

    bench = erp(f"""SELECT p.strProductBrand AS b, p.strProductSKU AS sku, p.strGroup AS g,
       COUNT(DISTINCT r.intCompetitorProductId) AS prods, COUNT(*) AS n,
       AVG(r.numMRP) AS mrp, AVG(r.numDP) AS dp, AVG(r.numTP) AS tp,
       MIN(r.numMRP) AS mrpMin, MAX(r.numMRP) AS mrpMax
FROM oms.tblCompetitorPriceRow r
JOIN oms.tblCompetitorPriceHeader h ON h.intCompetitorPriceHeaderId = r.intCompetitorPriceHeaderId
JOIN oms.tblCompetitorProduct p ON p.intCompetitorProductId = r.intCompetitorProductId
WHERE h.intBusinessUnitId = {bu} AND r.isActive = 1
  AND p.strGroup IN ('Rice','Flour','Oil','Salt','Sugar') AND (r.numMRP > 0 OR r.numDP > 0)
GROUP BY p.strProductBrand, p.strProductSKU, p.strGroup
ORDER BY p.strGroup, p.strProductSKU, b""")
    json.dump({"rows": bench}, open(os.path.join(DATA, "competitor_bench.json"), "w", encoding="utf-8"), separators=(",", ":"))
    print(f"competition: market={len(mkt)} bench={len(bench)}")

    # ---- schemes + booked discounts ----
    offh = erp(f"""SELECT intTradeOfferConditionId AS id, strTradeOfferName AS nm,
       strTradeOfferConditionTypeName AS typ, strItemReffName AS item,
       intPartnerReffId AS ch, strPartnerReffName AS chn, isSlabProgram AS slab,
       dteStartDate AS f, dteEndDate AS l, isActive AS act
FROM rtm.tblRTMTradeOfferSetupHeader WHERE intBusinessUnitId = {bu}
GROUP BY intTradeOfferConditionId, strTradeOfferName, strTradeOfferConditionTypeName,
         strItemReffName, intPartnerReffId, strPartnerReffName, isSlabProgram,
         dteStartDate, dteEndDate, isActive
ORDER BY id""")
    for r in offh:
        r["f"] = str(r["f"])[:10]; r["l"] = str(r["l"])[:10]
    json.dump({"rows": offh}, open(os.path.join(DATA, "offers_header.json"), "w", encoding="utf-8"), separators=(",", ":"))

    sch = erp(f"""SELECT intTradeOfferConditionId AS id, COUNT(*) AS slabs,
       MIN(numBaseFrom) AS bf, MAX(numBaseTo) AS bt,
       MIN(numOfferQuantity) AS qmin, MAX(numOfferQuantity) AS qmax,
       MIN(numOfferPercent) AS pmin, MAX(numOfferPercent) AS pmax,
       MIN(numOfferAmount) AS amin, MAX(numOfferAmount) AS amax,
       MAX(strOfferItemName) AS onm, MAX(strOfferItemCode) AS oc, MAX(strOfferItemUom) AS uom
FROM rtm.tblRTMTradeOfferSetupRow WHERE intBusinessUnitId = {bu}
GROUP BY intTradeOfferConditionId ORDER BY id""")
    json.dump({"rows": sch}, open(os.path.join(DATA, "schemes.json"), "w", encoding="utf-8"), separators=(",", ":"))

    booked = erp(f"""SELECT LEFT(CONVERT(varchar(7), dteLastActionDateTime, 120), 7) AS ym,
       strDiscountTypeName AS type, SUM(numDiscount) AS amt, COUNT(*) AS cnt
FROM oms.tblSalesOrderRowDiscount WHERE intBusinessUnitId = {bu} AND isActive = 1
GROUP BY LEFT(CONVERT(varchar(7), dteLastActionDateTime, 120), 7), strDiscountTypeName
ORDER BY ym, amt DESC""")
    json.dump(booked, open(os.path.join(DATA, "discount_booked.json"), "w", encoding="utf-8"), separators=(",", ":"))
    print(f"incentives: schemes={len(offh)} booked={len(booked)}")

    # ---- P&L from the GL (BU level) ----
    pl = erp(f"""SELECT LEFT(CONVERT(varchar(7), dteTransactionDate, 120), 7) AS ym,
       CAST(SUM(CASE WHEN strGeneralLedgerCode IN ('3010001','3010002','3010003','3010005','3010006') THEN -numAmount ELSE 0 END) AS BIGINT) AS revenue,
       CAST(SUM(CASE WHEN strGeneralLedgerCode = '4810001' THEN numAmount ELSE 0 END) AS BIGINT) AS cogs,
       CAST(SUM(CASE WHEN strGeneralLedgerCode = '4010001' THEN numAmount ELSE 0 END) AS BIGINT) AS mfg,
       CAST(SUM(CASE WHEN strGeneralLedgerCode = '4310001' THEN numAmount ELSE 0 END) AS BIGINT) AS selling,
       CAST(SUM(CASE WHEN strGeneralLedgerCode = '4410001' THEN numAmount ELSE 0 END) AS BIGINT) AS logistics,
       CAST(SUM(CASE WHEN strGeneralLedgerCode = '4210001' THEN numAmount ELSE 0 END) AS BIGINT) AS marketing,
       CAST(SUM(CASE WHEN strGeneralLedgerCode = '4110001' THEN numAmount ELSE 0 END) AS BIGINT) AS admin,
       CAST(SUM(CASE WHEN strGeneralLedgerCode = '4510001' THEN numAmount ELSE 0 END) AS BIGINT) AS financial,
       CAST(SUM(CASE WHEN strGeneralLedgerCode = '3010004' THEN -numAmount ELSE 0 END) AS BIGINT) AS other_income
FROM fin.tblAccountingJournal
WHERE intBusinessUnitId = {bu} AND isActive = 1
 AND strGeneralLedgerCode IN ('3010001','3010002','3010003','3010005','3010006','4810001','4010001','4310001','4410001','4210001','4110001','4510001','3010004')
 AND dteTransactionDate >= '2022-07-01'
GROUP BY LEFT(CONVERT(varchar(7), dteTransactionDate, 120), 7)
ORDER BY ym""")
    json.dump({"rows": pl}, open(os.path.join(DATA, "pl_monthly.json"), "w", encoding="utf-8"), separators=(",", ":"))
    print(f"GL: {len(pl)} months of P&L")

    # ---- delivery activity (BU level; not channel-filterable) ----
    delfy = erp(f"""SELECT CASE WHEN MONTH(h.dteDeliveryDate)>=7 THEN YEAR(h.dteDeliveryDate) ELSE YEAR(h.dteDeliveryDate)-1 END AS fy,
       COUNT(DISTINCT h.intDeliveryId) AS deliveries, CAST(SUM(h.numTotalNetValue) AS BIGINT) AS value,
       COUNT(DISTINCT h.intShipToPartnerId) AS partners
FROM sms.tblDeliveryHeader h
WHERE h.intBusinessUnitId = {bu} AND h.isActive = 1
GROUP BY CASE WHEN MONTH(h.dteDeliveryDate)>=7 THEN YEAR(h.dteDeliveryDate) ELSE YEAR(h.dteDeliveryDate)-1 END
ORDER BY fy""")
    json.dump({"rows": delfy}, open(os.path.join(DATA, "delivery_fy.json"), "w", encoding="utf-8"), separators=(",", ":"))

    zones = erp(f"""SELECT TOP 40 h.strTransportZoneName AS zone, COUNT(DISTINCT h.intDeliveryId) AS dels,
       CAST(SUM(h.numTotalNetValue) AS BIGINT) AS value
FROM sms.tblDeliveryHeader h
WHERE h.intBusinessUnitId = {bu} AND h.isActive = 1 AND h.dteDeliveryDate >= '2025-07-01'
GROUP BY h.strTransportZoneName ORDER BY value DESC""")
    json.dump({"rows": zones}, open(os.path.join(DATA, "zones.json"), "w", encoding="utf-8"), separators=(",", ":"))
    print(f"delivery: {len(delfy)} fiscal years, {len(zones)} zones")

    # ---- categories ----
    try:
        url = f"https://docs.google.com/spreadsheets/d/{CATEGORY_SHEET}/export?format=csv&gid=0"
        r = requests.get(url, timeout=60)
        r.raise_for_status()
        open(os.path.join(DATA, "categories_raw.csv"), "wb").write(r.content)
        print("categories: downloaded")
    except Exception as e:  # noqa: BLE001
        print(f"categories: download failed ({e}); keeping existing file", file=sys.stderr)

    # ---- reconciliation ----
    end_ym = all_months[-1]
    total = erp(f"SELECT COUNT(DISTINCT r.strItemCode) AS skus FROM oms.tblsalesorderrow r "
                f"WHERE r.intBusinessUnitId = {bu} AND EXISTS (SELECT 1 FROM oms.tblSalesOrderHeader h "
                f"WHERE h.intSalesOrderId = r.intSalesOrderId AND h.isActive = 1 "
                f"AND h.dteSalesOrderDate >= '{first}-01' AND h.dteSalesOrderDate < '{next_month(end_ym)}-01')")[0]["skus"]
    have = len({r["c"] for r in panel})
    print(f"reconciliation: ERP {total} distinct SKUs · panel {have}")
    if have < total - 5:
        print("WARNING: panel has fewer SKUs than the ERP -- a month may be incomplete", file=sys.stderr)


if __name__ == "__main__":
    main()
