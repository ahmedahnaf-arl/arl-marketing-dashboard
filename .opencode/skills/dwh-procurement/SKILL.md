---
name: dwh-procurement
description: Use ONLY when analyzing procurement: purchase orders, purchase requests, RFQs, supplier agreements, supplier invoices, supplier performance, or sourcing. Triggers on keywords: procurement, purchase order, PO, PR, purchase request, RFQ, supplier, vendor, sourcing, negotiation, agreement, contract, AP, supplier invoice, spend analysis.
---

# Procurement Analysis — pro, inv, prt Schemas

## Core Procurement Schema: [pro]

| Table | Purpose |
|-------|---------|
| `[pro].tblPurchaseOrderHeaderArc` | PO headers — supplier, dates, status, totals |
| `[pro].tblPurchaseOrderRowArc` | PO line items — items, quantities, prices |
| `[pro].tblPurchaseRequestHeaderArc` | PR headers — requisition details |
| `[pro].tblPurchaseRequestRowArc` | PR line items |
| `[pro].tblSupplierAgreementHeaderArc` | Contract/agreement headers |
| `[pro].tblRFQNegotiationHeaderArc` | RFQ and negotiation headers |

## Supplier Invoice Schema: [inv]

| Table | Purpose |
|-------|---------|
| `[inv].tblSupplierInvoiceHeaderArc` | AP invoice headers |
| `[inv].tblSupplierInvoiceRowArc` | AP invoice line items |

## Business Partner Schema: [prt]

| Table | Purpose |
|-------|---------|
| `[prt].tblBusinessPartnerArc` | All business partners (customers, suppliers, etc.) |
| `[prt].tblBusinessPartnerSalesArc` | Sales-specific partner attributes |
| `[prt].tblPartnerLocationRegisterArc` | Partner locations/addresses |

## Procure-to-Pay Data Flow

```
[pro].tblPurchaseRequestHeaderArc/RowArc   (Requisition)
    → [pro].tblRFQNegotiationHeaderArc     (Sourcing/RFQ)
    → [pro].tblSupplierAgreementHeaderArc  (Contract)
    → [pro].tblPurchaseOrderHeaderArc/RowArc (PO)
    → [inv].tblSupplierInvoiceHeaderArc/RowArc (AP Invoice)
    → [fin].tblAccountingJournalArc        (GL Posting)
```

## Key Procurement KPIs & Queries

### 1. Spend Analysis by Supplier
```sql
-- [pro].tblPurchaseOrderHeaderArc JOIN [pro].tblPurchaseOrderRowArc
-- JOIN [prt].tblBusinessPartnerArc
-- Group by supplier, period, category
-- Sum monNetAmount or monTotalAmount
```

### 2. PR-to-PO Cycle Time
```sql
-- DATEDIFF(day, PR.dteCreatedDate, PO.dteOrderDate)
-- Join [pro].tblPurchaseRequestHeaderArc → [pro].tblPurchaseOrderHeaderArc
-- Track by department, category, approver
```

### 3. PO-to-Invoice Cycle Time
```sql
-- DATEDIFF(day, PO.dteOrderDate, INV.dteInvoiceDate)
-- Join [pro].tblPurchaseOrderHeaderArc → [inv].tblSupplierInvoiceHeaderArc
```

### 4. Supplier On-Time Delivery
```sql
-- PO.dteExpectedDeliveryDate vs actual receipt date
-- From [pro].tblPurchaseOrderHeaderArc/RowArc
-- Join to [wms].tblInventoryTransactionHeaderArc for receipt confirmation
-- OTD% = On-time lines / Total lines
```

### 5. Price Variance Analysis
```sql
-- PO price vs Agreement price vs Last PO price
-- [pro].tblPurchaseOrderRowArc JOIN [pro].tblSupplierAgreementHeaderArc
-- Variance = (Actual - Standard) * Qty
```

### 6. Maverick Spend
```sql
-- POs without PR / POs outside agreements
-- [pro].tblPurchaseOrderHeaderArc LEFT JOIN [pro].tblPurchaseRequestHeaderArc
-- Filter: PR IS NULL (no requisition) OR no valid agreement
```

### 7. Top Suppliers by Spend
```sql
-- Rank suppliers by total PO value over trailing 12 months
-- Include: supplier name, total spend, % of total, item categories
```

### 8. Open PO Report
```sql
-- [pro].tblPurchaseOrderHeaderArc WHERE isOpen = 1 OR isFullyReceived = 0
-- Show: PO#, supplier, item, ordered qty, received qty, balance
```

## Common Join Pattern

All procurement entities link via:
- `intBusinessPartnerId` → [prt].tblBusinessPartnerArc (supplier)
- `intItemId` → [itm].tblItemArc (product)
- `intBusinessUnitId` → [dco].tblbusinessunitArc
- `intPlantId` or `intWarehouseId` → [wms] tables (delivery location)
