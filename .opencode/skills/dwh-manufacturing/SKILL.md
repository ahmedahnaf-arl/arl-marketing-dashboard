---
name: dwh-manufacturing
description: Use ONLY when analyzing manufacturing: production orders, BOM, routing, work centers, production planning, sales plans, demand plans, capacity, or shop floor. Triggers on keywords: manufacturing, production, BOM, bill of material, routing, work center, production order, shop floor, capacity, OEE, yield, plan-to-produce, demand plan, sales plan, production plan, batch.
---

# Manufacturing Analysis — mes Schema

## Core Manufacturing Schema: [mes]

| Table | Purpose |
|-------|---------|
| `[mes].tblProductionPlanningHeaderArc` | Production plan headers |
| `[mes].tblProductionPlanningRowArc` | Production plan line items |
| `[mes].tblSalesPlanHeaderArc` | Sales forecast/plan headers |
| `[mes].tblSalesPlanRowArc` | Sales plan line items |
| `[mes].tblDemandPlanHeaderArc` | Demand forecast headers |
| `[mes].tblDemandPlanRowArc` | Demand plan line items |
| `[mes].tblBillOfMaterialHeaderArc` | BOM headers (parent item) |
| `[mes].tblBillOfMaterialRowArc` | BOM components (child items, qty per) |
| `[mes].tblProductionOrderArc` | Production orders (batch/job) |
| `[mes].tblWorkCenterArc` | Work centers / machine groups |
| `[mes].tblRoutingArc` | Routing steps (operations sequence) |

## Plan-to-Produce Flow

```
[mes].tblDemandPlanHeaderArc/RowArc     (Forecast demand)
    → [mes].tblSalesPlanHeaderArc/RowArc   (Sales target)
    → [mes].tblProductionPlanningHeaderArc/RowArc (Production plan)
    → [mes].tblBillOfMaterialHeaderArc/RowArc (BOM explosion)
    → [mes].tblRoutingArc                   (Routing assignment)
    → [mes].tblProductionOrderArc           (Shop order release)
    → [wms].tblInventoryTransactionHeaderArc/RowArc (Material issue/receipt)
```

## Key Manufacturing KPIs & Queries

### 1. OEE (Overall Equipment Effectiveness)
```sql
-- Availability = Actual Run Time / Planned Production Time
-- Performance = Actual Output / Theoretical Output at actual speed
-- Quality = Good Units / Total Units Produced
-- OEE = Availability × Performance × Quality
-- Sources: [mes].tblProductionOrderArc, [mes].tblWorkCenterArc
```

### 2. Production Yield
```sql
-- Yield = Good Output Qty / Input Qty × 100
-- From [mes].tblProductionOrderArc
-- Group by product, batch, work center, period
-- Identify yield loss trends
```

### 3. Schedule Adherence
```sql
-- Planned qty from [mes].tblProductionPlanningHeaderArc/RowArc
-- vs Actual produced from [mes].tblProductionOrderArc
-- Adherence% = (Actual within window) / Planned
-- By work center, product, shift, day
```

### 4. BOM Cost Roll-Up
```sql
-- [mes].tblBillOfMaterialHeaderArc JOIN [mes].tblBillOfMaterialRowArc
-- Recursive or level-by-level cost accumulation
-- Material cost + Labor cost + Overhead
-- Compare standard cost vs actual cost
```

### 5. Capacity Utilization
```sql
-- [mes].tblWorkCenterArc capacity (numCapacityHours or similar)
-- vs Actual hours from [mes].tblProductionOrderArc
-- Utilization% = Actual / Capacity × 100
-- Identify bottlenecks
```

### 6. Production Order Cycle Time
```sql
-- DATEDIFF(hour/day, dteStartDate, dteEndDate) from [mes].tblProductionOrderArc
-- Track by product type, batch size, work center
```

### 7. WIP (Work in Process) Analysis
```sql
-- [mes].tblProductionOrderArc WHERE status NOT IN ('Completed', 'Closed')
-- Value of WIP = Material issued + Labor + Overhead applied
-- Aging of WIP orders
```

### 8. Plan vs Actual Comparison
```sql
-- Demand Plan → Sales Plan → Production Plan → Actual Production
-- Four-way comparison across [mes] tables
-- Gap analysis at each planning level
```

### 9. Material Consumption Variance
```sql
-- Standard qty from BOM ([mes].tblBillOfMaterialRowArc)
-- vs Actual issued from [wms].tblInventoryTransactionHeaderArc/RowArc
-- Variance = (Actual - Standard) × Standard Cost
```

## Common Join Pattern

- `intItemId` → [itm].tblItemArc (finished good or raw material)
- `intWorkCenterId` → [mes].tblWorkCenterArc
- `intRoutingId` → [mes].tblRoutingArc
- `intPlantId` → [wms].tblPlantArc
- `intBOMId` (header/row relationship within BOM)
- `intProductionOrderId` → [mes].tblProductionOrderArc

## BOM Navigation

BOMs may be multi-level. To explode a full BOM:
1. Start with finished good itemId in [mes].tblBillOfMaterialHeaderArc
2. Get component itemIds from [mes].tblBillOfMaterialRowArc
3. For each component, check if it has its own BOM header (sub-assembly)
4. Recurse until raw materials (no BOM header found)
