---
name: dwh-finance
description: Use ONLY when performing financial analysis: GL, Trial Balance, P&L, Balance Sheet, Budget vs Actual, COGS, profitability, cost centers, or profit centers. Triggers on keywords: finance, GL, journal, trial balance, P&L, profit loss, balance sheet, budget, actual, COGS, cost, expense, revenue, income, profit center, cost center, accounting, debit, credit, fiscal year, period.
---

# Financial Analysis — fin, bgt, cco Schemas

## Core Finance Schema: [fin]

| Table | Purpose |
|-------|---------|
| `[fin].tblAccountingJournalArc` | General Ledger journal entries — the **single source of truth** for all financial postings |

## Controlling Schema: [cco]

| Table | Purpose |
|-------|---------|
| `[fin].tblProfitCenterArc` | Profit center master data |
| `[fin].tblAssetLiabilityPlanArc` | Asset and liability planning |

## Budgeting Schema: [bgt]

| Table | Purpose |
|-------|---------|
| `[bgt].tblBudgetIncomeExpenseHeaderArc` | Budget header — income/expense plans |
| `[bgt].tblBudgetIncomeExpenseRowArc` | Budget line items |

## Key GL Journal Fields (tblAccountingJournalArc)

Look for patterns:
- `int*` columns: IDs for dimensions (account, business unit, cost center, profit center, etc.)
- `str*` columns: Description, reference, voucher number
- `mon*` columns: Debit amount, Credit amount, Net amount (monDebitAmount, monCreditAmount)
- `dte*` columns: Posting date, document date (dtePostingDate, dteDocumentDate)
- `is*` columns: Status flags (posted, reversed, etc.)

## Common Financial Queries

### 1. Trial Balance (for a period)
```sql
-- Sum debits and credits from [fin].tblAccountingJournalArc
-- Group by intAccountId / intNaturalAccountId
-- Filter by dtePostingDate range and isPosted = 1
-- If monDebitAmount - monCreditAmount <> 0 for sum, it's unbalanced
```

### 2. P&L Statement
```sql
-- Revenue accounts (typically 4xxxxx or 5xxxxx range)
-- COGS accounts (typically 5xxxxx or 6xxxxx range)
-- Expense accounts (typically 6xxxxx or 7xxxxx range)
-- Filter by intFiscalYearId, intFiscalPeriodId
-- Net = Revenue - COGS - Expenses
```

### 3. Budget vs Actual
```sql
-- [bgt].tblBudgetIncomeExpenseRowArc (budget amounts)
-- vs [fin].tblAccountingJournalArc (actual postings)
-- Join on: account code, period, business unit, cost center
-- Variance = Actual - Budget; Variance% = (Actual-Budget)/Budget * 100
```

### 4. COGS Analysis
```sql
-- From [fin].tblAccountingJournalArc
-- Filter COGS-related accounts
-- Join to [wms].tblInventoryTransactionHeaderArc for quantity context
-- Join to [itm].tblItemArc for product details
-- COGS per unit, COGS trend over periods
```

### 5. Profit Center P&L
```sql
-- From [fin].tblAccountingJournalArc
-- Join [cco].tblProfitCenterArc
-- Group by profit center, period
-- Revenue, cost, margin per profit center
```

### 6. Working Capital
```sql
-- AR: Outstanding from [oms].tblSalesInvoiceArc where unpaid
-- AP: Outstanding from [inv].tblSupplierInvoiceHeaderArc where unpaid
-- Inventory: Value from [wms].tblInventoryTransactionHeaderArc
-- Working Capital = AR + Inventory - AP
```

## Always Check With

```sql
SELECT COLUMN_NAME, DATA_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'fin' AND TABLE_NAME = 'tblAccountingJournalArc';
```

before writing queries — exact column names may vary.
