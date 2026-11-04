const fs=require('fs');let p=fs.readFileSync('refresh.py','utf8');
p=p.replace(`    # ---- categories ----`,
`    # ---- delivery activity (BU level; not channel-filterable) ----
    delfy = erp(f"""SELECT CASE WHEN MONTH(h.dteDeliveryDate)>=7 THEN YEAR(h.dteDeliveryDate) ELSE YEAR(h.dteDeliveryDate)-1 END AS fy,
       COUNT(DISTINCT h.intDeliveryId) AS deliveries, CAST(SUM(h.numTotalNetValue) AS BIGINT) AS value
FROM sms.tblDeliveryHeader h
WHERE h.intBusinessUnitId = {bu} AND h.isActive = 1
GROUP BY CASE WHEN MONTH(h.dteDeliveryDate)>=7 THEN YEAR(h.dteDeliveryDate) ELSE YEAR(h.dteDeliveryDate)-1 END
ORDER BY fy""")
    json.dump({"rows": delfy}, open(os.path.join(DATA, "delivery_fy.json"), "w", encoding="utf-8"), separators=(",", ":"))

    zones = erp(f"""SELECT h.strTransportZoneName AS zone, COUNT(DISTINCT h.intDeliveryId) AS dels,
       CAST(SUM(h.numTotalNetValue) AS BIGINT) AS value
FROM sms.tblDeliveryHeader h
WHERE h.intBusinessUnitId = {bu} AND h.isActive = 1 AND h.dteDeliveryDate >= '2025-07-01'
GROUP BY h.strTransportZoneName ORDER BY value DESC""")
    json.dump({"rows": zones}, open(os.path.join(DATA, "zones.json"), "w", encoding="utf-8"), separators=(",", ":"))
    print(f"delivery: {len(delfy)} fiscal years, {len(zones)} zones")

    # ---- categories ----`);
fs.writeFileSync('refresh.py',p);console.log('refresh.py extended');
