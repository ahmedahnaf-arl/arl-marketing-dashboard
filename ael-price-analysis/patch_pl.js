const fs=require('fs');let p=fs.readFileSync('refresh.py','utf8');
p=p.replace(`    # ---- delivery activity (BU level; not channel-filterable) ----`,
`    # ---- P&L from the GL (BU level) ----
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

    # ---- delivery activity (BU level; not channel-filterable) ----`);
fs.writeFileSync('refresh.py',p);console.log('GL pull added');
