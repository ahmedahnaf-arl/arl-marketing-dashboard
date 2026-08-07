---
name: dwh-inventory
description: Use ONLY when analyzing inventory, warehouse operations, stock movements, gate passes, inventory valuation, stock aging, or plant/warehouse performance. Triggers on keywords: inventory, stock, warehouse, WMS, gate pass, plant, location, bin, receipt, issue, transfer, stock take, valuation, aging, slow-moving, obsolete, inventory turnover, days on hand, safety stock.
---

# Inventory & Warehouse Analysis — wms Schema

## Core Warehouse Schema: [wms]

| Table | Purpose |
|-------|---------|
| `[wms].tblInventoryTransactionHeaderArc` | Inventory movement headers (receipt, issue, transfer) |
| `[wms].tblInventoryTransactionRowArc` | Inventory movement line items |
| `[wms].tblPlantArc` | Plant/site master data |
| `[wms].tblWarehouseArc` | Warehouse master data |
| `[wms].tblGatePassHeaderArc` | Gate pass headers (entry/exit authorization) |
| `[wms].tblGatePassRowArc` | Gate pass line items |
| `[wms].tblInventoryLocationArc` | Bin/location within warehouse |

## Inventory Transaction Types

Typical movement types (look for `strTransactionType` or similar):
- **Receipt**: Goods receipt from production, PO receipt, return receipt
- **Issue**: Material issue to production, sales delivery issue
- **Transfer**: Inter-warehouse, inter-plant, inter-location
- **Adjustment**: Stock count adjustments, write-offs
- **Return**: Customer return receipt, supplier return issue

## Key Inventory KPIs & Queries

### 1. Current Stock Position
```sql
-- [wms].tblInventoryTransactionHeaderArc/RowArc
-- Sum quantities by item, warehouse, location, batch, status
-- Receipts (+), Issues (-), net = current stock
-- Filter by isPosted or isActive flags
```

### 2. Inventory Valuation
```sql
-- Stock qty × Unit cost (from receipt transactions or standard cost)
-- Methods: FIFO, Weighted Average, Standard Cost
-- By item, category, warehouse, business unit
-- Total inventory value on balance sheet
```

### 3. Inventory Turnover
```sql
-- COGS (from fin or consumption transactions) / Average Inventory
-- Over trailing 12 months
-- By item, category, warehouse
```

### 4. Days Inventory Outstanding (DIO)
```sql
-- DIO = (Average Inventory / COGS) × 365
-- Lower is better (faster turnover)
-- Measure cash tied up in inventory
```

### 5. Stock Aging / Slow-Moving Analysis
```sql
-- Last movement date per item per location
-- Age = DATEDIFF(day, lastMovementDate, GETDATE())
-- Buckets: 0-30, 31-60, 61-90, 91-180, 181-365, 365+
-- Value at risk = aged stock × unit cost
```

### 6. ABC Analysis
```sql
-- By consumption value (qty × cost) over trailing 12 months
-- A: Top 80% of value (typically ~20% of items)
-- B: Next 15% of value (~30% of items)
-- C: Bottom 5% of value (~50% of items)
-- Different replenishment strategies per class
```

### 7. Stock Accuracy
```sql
-- Compare system stock vs physical count
-- Accuracy% = (1 - |System - Physical| / System) × 100
-- By warehouse, item category
-- From stock take/adjustment transactions
```

### 8. Reorder Point & Safety Stock
```sql
-- Lead time demand = Avg daily demand × Lead time days
-- Safety stock = Z × σ(LT demand)
-- Reorder point = Lead time demand + Safety stock
-- Flag items where current stock < reorder point
```

### 9. Gate Pass Analysis
```sql
-- [wms].tblGatePassHeaderArc/RowArc
-- Gate pass volume by type (entry/exit), by gate, by time of day
-- Throughput time = exit time - entry time
-- Anomalies: missing exit for entry, excessive dwell time
```

### 10. Warehouse Space Utilization
```sql
-- [wms].tblInventoryLocationArc — total locations/bins
-- Occupied locations vs total locations
-- Utilization% = Occupied / Total × 100
-- By warehouse, zone, aisle
```

### 11. Inter-Warehouse Transfer Analysis
```sql
-- Transfer transactions in [wms].tblInventoryTransactionHeaderArc
-- Volume and value transferred between warehouses
-- Transfer cost, frequency, lead time
-- Net flow per warehouse pair
```

## Common Join Pattern

- `intItemId` → [itm].tblItemArc (product/location)
- `intPlantId` → [wms].tblPlantArc
- `intWarehouseId` → [wms].tblWarehouseArc
- `intInventoryLocationId` → [wms].tblInventoryLocationArc
- `intGatePassId` → Gate pass reference
- `intBusinessPartnerId` → [prt].tblBusinessPartnerArc (for external movements)
- `intReferenceId` / `strReferenceNo` → Source document (PO, Production Order, etc.)

## Critical Query Pattern for Stock Balance

```sql
-- Always use Header-to-Row join:
-- [wms].tblInventoryTransactionHeaderArc hdr
-- JOIN [wms].tblInventoryTransactionRowArc row ON hdr.intInventoryTransactionId = row.intInventoryTransactionId
-- Filter by dteTransactionDate, isPosted, intItemId, intWarehouseId
-- Sum with sign: Receipts (+) , Issues (-)
```
