---
name: dwh-sales
description: Use ONLY when analyzing sales, orders, deliveries, shipments, returns, route-to-market, distribution, incentives, or customer performance. Triggers on keywords: sales, order, delivery, shipment, invoice, quotation, return, customer, outlet, route, territory, distribution, incentive, OTIF, DSO, perfect order, channel, sell-through, sell-in.
---

# Sales & Distribution Analysis — oms, sms, tms, rtm Schemas

## Order Management: [oms]

| Table | Purpose |
|-------|---------|
| `[oms].tblSalesOrderHeaderArc` | Sales order headers |
| `[oms].tblSalesOrderRowArc` | Sales order line items |
| `[oms].tblSalesQuotationHeaderArc` | Quotation headers |
| `[oms].tblSalesQuotationRowArc` | Quotation line items |
| `[oms].tblSalesInvoiceArc` | Customer invoices |
| `[oms].tblSalesOrganizationArc` | Sales org structure |
| `[oms].tblDistributionChannelArc` | Distribution channels |

## Sales/Delivery: [sms]

| Table | Purpose |
|-------|---------|
| `[sms].tblDeliveryHeaderArc` | Delivery note headers |
| `[sms].tblDeliveryRowArc` | Delivery line items |
| `[sms].tblSalesReturnHeaderArc` | Return headers |
| `[sms].tblSalesReturnRowArc` | Return line items |
| `[sms].tblIncentiveConfigHeaderArc` | Incentive/scheme configurations |

## Transport Management: [tms]

| Table | Purpose |
|-------|---------|
| `[tms].tblShipmentHeaderArc` | Shipment headers |
| `[tms].tblShipmentRowArc` | Shipment line items |
| `[tms].tblVehicleArc` | Vehicle master |
| `[tms].tblTransportRouteArc` | Transport routes |
| `[tms].tblShipmentPlanningArc` | Shipment planning |
| `[tms].tblTransportModeArc` | Transport modes (road, rail, etc.) |
| `[tms].tblShipmentCostRateArc` | Freight cost rates |

## Route-to-Market: [rtm]

| Table | Purpose |
|-------|---------|
| `[rtm].tblRouteArc` | Distribution routes |
| `[rtm].tblRoutePlanHeaderArc` | Route plan headers |
| `[rtm].tblRoutePlanRowArc` | Route plan details |
| `[rtm].tblOutletInfoBasicArc` | Outlet/retailer info |
| `[rtm].tblOutletDeliveryHeaderArc` | Outlet delivery headers |
| `[rtm].tblOutletDeliveryRowArc` | Outlet delivery details |
| `[rtm].tblTerritoryInfoArc` | Territory master |

## Order-to-Cash Flow

```
[oms].tblSalesOrderHeaderArc/RowArc     (Customer Order)
    → [sms].tblDeliveryHeaderArc/RowArc    (Delivery)
    → [tms].tblShipmentHeaderArc/RowArc    (Shipment if transported)
    → [oms].tblSalesInvoiceArc             (Invoice)
    → [fin].tblAccountingJournalArc        (Payment/GL)
    → [sms].tblSalesReturnHeaderArc/RowArc (Returns, if any)
```

## Route-to-Market Flow

```
[rtm].tblTerritoryInfoArc → [rtm].tblRouteArc → [rtm].tblRoutePlanHeaderArc/RowArc
    → [rtm].tblOutletInfoBasicArc → [rtm].tblOutletDeliveryHeaderArc/RowArc
    → [sms].tblDeliveryHeaderArc/RowArc
```

## Key Sales KPIs & Queries

### 1. Sales Performance (Value & Volume)
```sql
-- [oms].tblSalesOrderHeaderArc JOIN [oms].tblSalesOrderRowArc
-- Group by: period, customer, product, channel, territory, sales org
-- Sum monNetAmount (value), sum numQuantity (volume)
-- Compare: MoM, YoY, vs Budget, vs Target
```

### 2. OTIF (On-Time In-Full)
```sql
-- [oms].tblSalesOrderHeaderArc LEFT JOIN [sms].tblDeliveryHeaderArc
-- On-time: Actual delivery date <= Requested delivery date
-- In-full: Delivered qty >= Ordered qty
-- OTIF% = Orders meeting both / Total orders
```

### 3. DSO (Days Sales Outstanding)
```sql
-- AR from [oms].tblSalesInvoiceArc (unpaid invoices)
-- DSO = (AR / Total Credit Sales) × Days in Period
-- Track trend, by customer segment
```

### 4. Sales Return Rate
```sql
-- [sms].tblSalesReturnHeaderArc JOIN [oms].tblSalesOrderHeaderArc
-- Return Rate% = Return Value / Sales Value × 100
-- By product, customer, reason code, territory
```

### 5. Sales by Channel / Territory
```sql
-- [oms].tblSalesOrderHeaderArc
-- JOIN [oms].tblDistributionChannelArc
-- JOIN [rtm].tblTerritoryInfoArc (or territory mapping)
-- Value, volume, margin by channel/territory
```

### 6. Outlet Coverage & Productivity
```sql
-- [rtm].tblOutletInfoBasicArc — total outlets
-- JOIN [rtm].tblOutletDeliveryHeaderArc — active outlets with deliveries
-- Coverage% = Active outlets / Total outlets
-- Productivity = Sales value per active outlet
```

### 7. Delivery Cost Analysis
```sql
-- [tms].tblShipmentCostRateArc or [tms].tblShipmentHeaderArc
-- Delivery cost per unit, per km, per shipment
-- By route, vehicle type, territory
```

### 8. Quotation Conversion Rate
```sql
-- [oms].tblSalesQuotationHeaderArc → [oms].tblSalesOrderHeaderArc
-- Conversion% = Quotes converted to orders / Total quotes
-- Win/Loss analysis by product, customer, salesperson
```

### 9. Sell-In vs Sell-Out
```sql
-- Sell-In: [oms].tblSalesOrderHeaderArc (to distributor/channel)
-- Sell-Out: [rtm].tblOutletDeliveryHeaderArc (to retailer/outlet)
-- Sell-through% = Sell-out / Sell-in × 100
```

### 10. Incentive Effectiveness
```sql
-- [sms].tblIncentiveConfigHeaderArc schemes
-- Compare sales before/during/after incentive period
-- Incremental volume/value attributable to incentive
```

## Common Join Pattern

- `intBusinessPartnerId` → [prt].tblBusinessPartnerArc (customer)
- `intItemId` → [itm].tblItemArc (product)
- `intSalesOrganizationId` → [oms].tblSalesOrganizationArc
- `intDistributionChannelId` → [oms].tblDistributionChannelArc
- `intTerritoryId` → [rtm].tblTerritoryInfoArc
- `intRouteId` → [rtm].tblRouteArc
- `intVehicleId` → [tms].tblVehicleArc
