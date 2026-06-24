# Hanami by delphis — Resin Craft Business Tracker

A mobile-first business dashboard for handmade resin sellers. Bento-grid home, blush + lavender palette, Outfit/Figtree type, ৳ BDT throughout. Built on TanStack Start + Lovable Cloud with email/password auth and per-user RLS.

## Visual system

- Palette (locked): blush `#f8e8ee`, dusty pink `#e8c5d0`, lavender `#c9a0dc`, deep purple `#9b72cf`. Semantic: profit=emerald, expense=rose-600, low-stock=amber, info=lavender. Dark mode supported.
- Type: Outfit (display/numbers, black weight for KPIs) + Figtree (body), self-hosted via `@fontsource`.
- Shape language: `rounded-3xl` cards, soft shadows like cured resin, hairline dividers, generous whitespace.
- Motion: count-up KPIs, staggered card fade-rise, chart line draw, FAB press-scale.
- Layout: 390px-first; bottom nav pill (Dashboard, Products, Finance, Analytics, More) + center FAB "Record Sale". Desktop: same content centered in a max-width column.

## Information architecture (routes)

```
/auth                           sign in / sign up
/_authenticated/
  index                         Dashboard (bento home)
  products/                     list + detail + new
  products/$id                  product detail (recipe, sales, reviews)
  inventory                     materials with low-stock warnings
  orders                        Kanban (New → Processing → Shipped → Delivered)
  customers/                    cards + detail w/ lifetime value
  customers/$id
  finance                       revenue / expense / profit / reinvestment tabs
  finance/reinvestment          money-flow timeline
  analytics                     charts, top/worst products, AOV, heatmap
  ai-insights                   rule-based insight cards (AI hooks later)
  goals                         progress bars
  feedback                      reviews list + add
  more                          settings, suppliers, export, profile, sign out
```

Bottom nav: Dashboard, Products, Finance, Analytics, More. Other pages reached from More or from contextual links.

## Database schema (Lovable Cloud)

Every table has `user_id uuid references auth.users on delete cascade`, RLS enabled, policies `user_id = auth.uid()`, and explicit grants to `authenticated` + `service_role`.

Core tables:

- `profiles` — display name, business name, currency (default ৳), avatar, locale.
- `materials` — name, unit (g/pcs/ml), current_qty, low_threshold, avg_unit_cost.
- `material_purchases` — material_id, qty, total_cost, supplier_id, purchased_at. Trigger updates `materials.current_qty` and recomputes `avg_unit_cost`.
- `suppliers` — name, contact, notes.
- `products` — name, photo_url, selling_price, current_stock, category, archived.
- `product_recipe_items` — product_id, material_id, qty_per_unit. (Cost-per-unit derived = Σ qty × avg_unit_cost + labor + electricity.)
- `orders` — customer_id, status enum (new/processing/shipped/delivered/cancelled), platform enum (facebook/instagram/website/whatsapp/other), shipping_cost, payment_method (cash/bkash/nagad/bank), notes, ordered_at.
- `order_items` — order_id, product_id, qty, unit_price, unit_cost_snapshot. Trigger decrements product stock + materials on transition to `shipped`.
- `customers` — name, phone, address, notes.
- `expenses` — category_id, amount, description, spent_at, is_reinvestment bool, related_material_purchase_id nullable.
- `expense_categories` — name (Resin, Packaging, Equipment, Ads, Other).
- `reinvestments` — view over expenses where `is_reinvestment = true` grouped by month.
- `feedback` — customer_id, product_id, rating (1–5), comment, photo_url.
- `goals` — title, target_amount or target_count, metric_kind (revenue/units/savings/custom), deadline, completed.
- `wallets` — kind (cash/bkash/nagad/bank), balance. Adjusted by sales/expenses via trigger.
- `notifications` — kind, payload, read.

Derived via SQL views / RPCs:

- `v_product_cost(product_id)` → unit cost.
- `v_daily_sales(user_id, day)` → revenue, profit.
- `v_top_products`, `v_low_stock_materials`, `v_monthly_pnl`.

## Server functions (`src/lib/*.functions.ts`)

All use `requireSupabaseAuth`. Examples:

- `dashboard.functions.ts` → `getDashboardSnapshot()` (today sales/profit, pending orders count, low-stock count, 7-day revenue, top product, reinvestment summary, recent orders/expenses/feedback).
- `products.functions.ts` → list/get/create/update, compute cost.
- `orders.functions.ts` → list by status, create, transition status.
- `inventory.functions.ts` → list materials, record purchase.
- `finance.functions.ts` → monthly P&L, cash flow.
- `analytics.functions.ts` → growth %, AOV, best/worst products, platform breakdown.
- `insights.functions.ts` → rule-based insight cards (margin shifts, slow movers, projected runout based on 30-day burn).
- `goals.functions.ts`, `feedback.functions.ts`, `customers.functions.ts`.

`attachSupabaseAuth` appended to `src/start.ts` functionMiddleware (if not already wired).

## Auth

- `/auth` page: email/password sign in + sign up tabs, redirects to `/` on success.
- `_authenticated/route.tsx` (integration-managed) gates the app.
- Sign-up trigger creates a `profiles` row.
- Sign out from More → clear queries, navigate to `/auth`.

## Screen specs

- **Dashboard (bento)**: greeting + date • hero pair "Today's Sales / Today's Profit" (oversized Outfit Black) • mini cards: Pending Orders, Low Stock • 7-day revenue area chart • Top Product tactile card w/ margin badge • Reinvestment chip chain (Profit → Resin → Packaging → Remaining) • Recent Orders (3), Recent Expenses (2), Recent Feedback (1) • FAB "Record Sale".
- **Products**: card grid w/ photo, cost/price/profit/stock; detail shows recipe table, cost breakdown, sales history sparkline, reviews; "Record Sale" FAB on detail.
- **Inventory**: material rows with progress bars, "⚠ Low Soon" badge; tap → purchase history + supplier + avg cost.
- **Orders**: horizontal Kanban (swipe between columns on mobile), drag handle to advance status; tap → order detail w/ items, customer, totals.
- **Customers**: cards (name, orders, spent, rating, last purchase) → detail with timeline, LTV, favorite product.
- **Finance**: tabs Revenue / Expenses / Profit / Reinvestment; cash flow line chart; transactions list filterable.
- **Reinvestment**: vertical money-flow timeline (Profit ↓ Bought Resin ↓ Bought Packaging ↓ Remaining Cash).
- **Analytics**: KPI cards (Growth, Margin, AOV, Returning Customers, Best/Worst Product, Most Expensive Material, Best Month) + bar/line/pie + day-of-week heatmap.
- **AI Insights**: rule-based cards now (margin delta, slow movers, projected resin runout, best day-of-week); marked "Powered by Hanami AI" with a placeholder hook ready for Lovable AI Gateway later.
- **Goals**: list w/ progress bars, add modal.
- **Feedback**: list with large stars and photo; add review modal.
- **More/Settings**: business profile, currency (defaults ৳), wallets, suppliers, export CSV, dark mode toggle, sign out.

## Tech notes

- TanStack Query loaders + `useSuspenseQuery`; mutations invalidate keys.
- Charts via `recharts` (already common in shadcn). Drag-and-drop Kanban via `@dnd-kit/core`.
- Self-host fonts via `@fontsource/outfit` and `@fontsource/figtree`.
- Numbers formatted with `Intl.NumberFormat('en-IN')` and ৳ prefix; helper `formatBDT(n)`.
- Seed-data NOT included (per security rules); empty states show "Add your first product / material / order".

## Build order (one turn, parallel where possible)

1. Enable Lovable Cloud.
2. Migration: enums, all tables, RLS + grants, triggers (stock decrement, avg cost), views.
3. Auth page + profile trigger.
4. App shell: bottom nav, FAB, theme tokens, fonts.
5. Server functions for each domain.
6. Screens in order: Dashboard → Products → Inventory → Orders → Customers → Finance → Reinvestment → Analytics → Insights → Goals → Feedback → Settings.
7. Verify build green.

## Out of scope (later)

- Real ML predictions (we ship rule-based insights now; Lovable AI Gateway hook is ready to swap in).
- Multi-business / staff accounts.
- Photo uploads for products/feedback in v1 use URL field; Cloud Storage upload widget later.
- PDF export (CSV only in v1).