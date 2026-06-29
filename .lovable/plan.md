## Scope

Implement the 8 requested changes across UI, server functions, and DB.

## Files affected

- `src/components/app/AppShell.tsx` — accept `hideNav` to hide BottomNav + FAB on nested pages; apply safe-area + 100dvh so background paints under system bars.
- `src/components/app/BottomNav.tsx` — no logic change (controlled by AppShell prop).
- `src/routes/_authenticated/dashboard.tsx` — remove "Low stock" KPI tile, remove the 7-day Revenue area chart, replace with new `SalesProfitChart` (uses cash flow data).
- `src/routes/_authenticated/finance.tsx` — remove the Cash flow chart card (moved to Home); remove Overhead switch + "spread over N uses" inputs from expense sheet.
- `src/routes/_authenticated/analytics.tsx` — remove the "Best sales days" weekday heatmap card.
- `src/routes/_authenticated/inventory.tsx` — remove low-stock threshold field, "Low" chip, threshold progress bar.
- `src/routes/_authenticated/orders.tsx`, `feedback.tsx`, `inventory.tsx`, `customers.tsx`, `goals.tsx`, `insights.tsx`, `finance.reinvestment.tsx` — pass `hideNav` to `AppShell`. Main 5 (dashboard, products, finance, analytics, more) keep nav.
- `src/components/products/ProductSurveySheet.tsx` — replace "overheads (split)" step with single direct "Overhead cost (৳)" numeric step.
- `src/routes/_authenticated/products.tsx` (ProductSheet) — drop overhead-expense multi-select, keep simple `overhead` numeric input only.
- `src/lib/dashboard.functions.ts` — return `cashflow_30d` series `{day, sales, profit}`; drop `low_stock_count`.
- `src/lib/finance.functions.ts` — drop `is_overhead`/`uses_total` from `createExpense` schema; remove `listOverheadExpenses` export.
- `src/lib/products.functions.ts` — remove `overhead_expense_ids`, `computeAmortizedOverhead`, `product_overheads` reads/writes; unit cost = materials + labor + overhead_cost only.
- `src/lib/inventory.functions.ts` — drop `low_threshold` from MaterialSchema + insert/update.
- `src/styles.css` — `html, body { min-height: 100dvh }` + `body { padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); background: var(--color-background); }`. Update `theme-color` meta in `__root.tsx` to match new card-soft surface so Android status bar isn't black.

## Database migration (single migration)

```
ALTER TABLE public.materials DROP COLUMN IF EXISTS low_threshold;
ALTER TABLE public.expenses  DROP COLUMN IF EXISTS is_overhead, DROP COLUMN IF EXISTS uses_total;
DROP TABLE IF EXISTS public.product_overheads;
```

(`product_recipe_items.material_name` / `unit_cost_override` and `products.overhead_cost` stay — they're still needed.)

## New chart spec

`SalesProfitChart` on Home, replacing the area chart slot.

- Top-right segmented toggle: `Days` (default) | `Months`.
- Days: last 14 days, x = `MM/DD`.
- Months: last 6 months, x = `Jan`, `Feb`, …
- Two bars per period: `Sales` (primary lavender) and `Profit` (profit green), `barCategoryGap="25%"`, `barGap={3}`, rounded radius `[4,4,0,0]`, height 180px, hidden Y axis, small X axis, tooltip showing both values with BDT format.
- Empty state: muted "No sales in this range yet."

Data source: extend `getDashboardSnapshot` to return `cashflow` with both granularities computed server-side (`days_14: {key, sales, profit}[]`, `months_6: {key, sales, profit}[]`) from the same orders query already in scope.

## Nav visibility rule

AppShell signature becomes:
```
AppShell({ title, subtitle, right, hideNav, children })
```
When `hideNav` is true, BottomNav + RecordSaleSheet FAB are not rendered and bottom padding drops from `pb-32` → `pb-8`. Main routes (`dashboard`, `products`, `finance`, `analytics`, `more`) omit the prop; every other authenticated route passes `hideNav`.

## Viewport / black-band fix

- Add to `src/styles.css`:
  ```css
  html, body { min-height: 100dvh; background-color: var(--color-background); }
  body { padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); }
  ```
- `__root.tsx`: change `theme-color` to the actual page bg (`#fdf7f9` to match `--background` light theme) so Android/iOS chrome tints to match instead of staying black.
- AppShell wrapper switches `min-h-screen` → `min-h-dvh`.

## Validation changes

- `ProductUpsertSchema` drops `overhead_expense_ids`; `overhead_cost ≥ 0` (already enforced).
- `ExpenseSchema` drops `is_overhead`, `uses_total`.
- `MaterialSchema` drops `low_threshold`.

## Order of build

1. Migration (drop columns/table).
2. Update server fns (`products`, `finance`, `inventory`, `dashboard`) — keeps types in sync.
3. Update components (`AppShell`, `BottomNav`, survey sheet, ProductSheet, Inventory page, Finance page, Analytics page, Dashboard page).
4. Add `SalesProfitChart` + Days/Months toggle on Dashboard.
5. Add `hideNav` to all non-main routes.
6. Style fixes (`styles.css`, theme-color).
7. Typecheck.
