---
name: dwh-schema
description: Use ONLY when querying the DWH database schema, looking up tables, understanding naming conventions, or navigating the 22-schema architecture. Triggers on keywords: DWH, schema, tables, tbl, Arc, naming convention, data warehouse, mssql, SQL Server, fully-qualified, int, str, num, mon, dte columns.
---

# DWH Schema Reference — Akij Resource Group

## Architecture

Microsoft SQL Server data warehouse with **22 schemas, 263+ tables**. Uses schema-based multi-tenant architecture. Every schema = one business module.

## Critical Rule

**Always use fully-qualified table names: `[schema].[table]`** — never omit the schema prefix.

## Naming Convention

| Prefix | Type | Meaning |
|--------|------|---------|
| `tbl` | Table | All transactional/master tables |
| `Arc` | Suffix | Archived/Aggregated data from OLTP |
| `int` | Column | ID/BigInt (FK references) |
| `str` | Column | String/NVARCHAR |
| `num` | Column | Numeric/Decimal |
| `mon` | Column | Monetary/Currency |
| `dte` | Column | Date/DateTime |
| `is` | Column | Bit/Boolean |
| `HeaderArc` | Suffix | Header-level entity (e.g. PO Header) |
| `RowArc` | Suffix | Line-item/detail entity (e.g. PO Row) |

## Full Schema → Domain Mapping

| Schema | Domain | Key Tables |
|--------|--------|------------|
| **fin** | Finance | tblAccountingJournalArc |
| **pro** | Procurement | tblPurchaseOrderHeaderArc/RowArc, tblPurchaseRequestHeaderArc/RowArc, tblSupplierAgreementHeaderArc/RowArc, tblRFQNegotiationHeaderArc/RowArc |
| **wms** | Warehouse Mgmt | tblInventoryTransactionHeaderArc/RowArc, tblPlantArc, tblWarehouseArc, tblGatePassHeaderArc/RowArc, tblInventoryLocationArc |
| **mes** | Manufacturing | tblProductionPlanningHeaderArc/RowArc, tblSalesPlanHeaderArc/RowArc, tblDemandPlanHeaderArc/RowArc, tblBillOfMaterialHeaderArc/RowArc, tblProductionOrderArc, tblWorkCenterArc, tblRoutingArc |
| **oms** | Order Management | tblSalesOrderHeaderArc/RowArc, tblSalesQuotationHeaderArc/RowArc, tblSalesInvoiceArc, tblSalesOrganizationArc, tblDistributionChannelArc |
| **sms** | Sales/Delivery | tblDeliveryHeaderArc/RowArc, tblSalesReturnHeaderArc/RowArc, tblIncentiveConfigHeaderArc/RowArc |
| **tms** | Transport Mgmt | tblShipmentHeaderArc/RowArc, tblVehicleArc, tblTransportRouteArc, tblShipmentPlanningArc, tblTransportModeArc, tblShipmentCostRateArc |
| **rtm** | Route-to-Market | tblRouteArc, tblRoutePlanHeaderArc/RowArc, tblOutletInfoBasicArc, tblOutletDeliveryHeaderArc/RowArc, tblTerritoryInfoArc |
| **prt** | Business Partners | tblBusinessPartnerArc, tblBusinessPartnerSalesArc, tblPartnerLocationRegisterArc |
| **itm** | Item Master | tblItemArc, tblItemMasterArc, tblItemCategoryArc |
| **sip** | Shipping/Import | tblShipBookingRequestHeaderArc, tblShippingInvoiceHeaderArc, tblTransportPlanningArc |
| **inv** | Supplier Invoice | tblSupplierInvoiceHeaderArc/RowArc |
| **saas** | HR | empEmployeeBasicInfoArc, timeEmployeeAttendanceArc, lveLeaveApplicationArc |
| **farm** | Agro/Farm | tblFarmerRegistrationArc, tblFarmRegistrationArc, tblFlockGenerateArc, tblAgroFeedArc |
| **cco** | Controlling | tblProfitCenterArc, tblAssetLiabilityPlanArc |
| **bgt** | Budgeting | tblBudgetIncomeExpenseHeaderArc/RowArc |
| **crm** | Service | ServiceOrderHeaderArc/RowArc |
| **pms** | Performance | tblWorkPlanHeaderArc/RowArc, tblActionPlanHeaderArc/RowArc |
| **etl** | ETL Tracking | SyncSource, SyncWatermark |
| **dco** | Data Control | tblbusinessunitArc, tblUserArc |
| **dbo** | Default | tblLetterOfCredit, tblUserGroupArc |

## Key Data Flows

### Plan-to-Produce Flow
mes (Demand Plan → Sales Plan → Production Plan) → mes (BOM/Routing) → mes (Production Order) → wms (Inventory Transactions)

### Procure-to-Pay Flow
pro (PR → RFQ → Supplier Agreement → PO) → inv (Supplier Invoice) → fin (GL Journal)

### Order-to-Cash Flow
oms (Sales Order) → sms (Delivery) → tms (Shipment) → oms (Invoice) → fin (GL Journal)

### Route-to-Market Flow
rtm (Territory → Route → Route Plan) → rtm (Outlet) → rtm (Outlet Delivery) → sms (Delivery)

## Query Patterns

When exploring a new schema, always start with:
```sql
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = '{schema}';
SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = '{schema}' AND TABLE_NAME = '{table}';
```
