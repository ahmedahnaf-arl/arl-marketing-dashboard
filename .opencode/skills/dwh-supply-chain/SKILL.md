---
name: dwh-supply-chain
description: Use ONLY when performing end-to-end supply chain analysis across Plan → Source → Make → Deliver → Return. Triggers on keywords: supply chain, SCOR, value stream, end-to-end, plan-to-produce, procure-to-pay, order-to-cash, route-to-market, cross-functional, throughput, lead time, cycle time, bottleneck, constraint.
---

# Supply Chain Analysis — End-to-End

## SCOR Model Alignment

| SCOR Phase | Schemas | Key Tables | KPIs |
|-----------|---------|------------|------|
| **Plan** | mes, bgt, cco | tblDemandPlanHeaderArc, tblSalesPlanHeaderArc, tblProductionPlanningHeaderArc, tblBudgetIncomeExpenseHeaderArc | Forecast Accuracy, Plan Adherence |
| **Source** | pro, inv, sip | tblPurchaseOrderHeaderArc/RowArc, tblSupplierInvoiceHeaderArc, tblSupplierAgreementHeaderArc | PO Cycle Time, Supplier OTD, Cost Variance |
| **Make** | mes, wms | tblProductionOrderArc, tblBillOfMaterialHeaderArc, tblWorkCenterArc, tblRoutingArc, tblInventoryTransactionHeaderArc | OEE, Yield, Schedule Adherence, WIP |
| **Deliver** | oms, sms, tms, rtm | tblSalesOrderHeaderArc, tblDeliveryHeaderArc, tblShipmentHeaderArc, tblOutletDeliveryHeaderArc | OTIF, Delivery Cost/Unit, Fleet Utilization |
| **Return** | sms, crm | tblSalesReturnHeaderArc/RowArc, ServiceOrderHeaderArc/RowArc | Return Rate, RMA Cycle Time |

## High-Impact Cross-Functional Queries

### 1. Plan vs Actual Production
```sql
-- Join mes demand/sales/production plans vs actual production orders
-- Compare planned qty (numPlannedQty) vs actual produced (numProducedQty)
```

### 2. Procure-to-Pay Cycle Time
```sql
-- pro.tblPurchaseRequestHeaderArc → pro.tblPurchaseOrderHeaderArc → inv.tblSupplierInvoiceHeaderArc
-- Measure: DATEDIFF between PR date and Invoice date
```

### 3. Order-to-Cash Cycle
```sql
-- oms.tblSalesOrderHeaderArc → sms.tblDeliveryHeaderArc → oms.tblSalesInvoiceArc → fin.tblAccountingJournalArc
-- Measure: DATEDIFF between Order date and Payment GL posting
```

### 4. Inventory Turnover & Days on Hand
```sql
-- wms.tblInventoryTransactionHeaderArc/RowArc over time
-- Join with itm.tblItemArc for product details
-- Calculate: COGS / Average Inventory
```

### 5. Perfect Order Rate
```sql
-- oms.tblSalesOrderHeaderArc LEFT JOIN sms.tblDeliveryHeaderArc LEFT JOIN sms.tblSalesReturnHeaderArc
-- Perfect = On-time + In-full + Damage-free + Correct docs
```

## Common Join Keys Across Modules

- `intBusinessUnitId` — Business unit (dco.tblbusinessunitArc)
- `intItemId` — Product/SKU (itm.tblItemArc)
- `intBusinessPartnerId` — Customer/Supplier (prt.tblBusinessPartnerArc)
- `intPlantId` — Plant/Site (wms.tblPlantArc)
- `intWarehouseId` — Warehouse (wms.tblWarehouseArc)
- `intCompanyId` — Legal entity (cross-schema)
- `intCurrencyId` — Currency (cross-schema)
- `intFiscalYearId` / `intFiscalPeriodId` — Time dimension
