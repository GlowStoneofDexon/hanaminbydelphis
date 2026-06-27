## Goal

Replace the AI-text Quick Add with a guided survey flow, make recipes free-text, auto-calculate overhead from expenses, fix the "0" placeholder issue, and trim the product form.

---

## 1. New product entry flow

**Remove:** `QuickAddSheet.tsx` (AI text-to-record) and the `quickCreateProduct` server function — no longer needed.

**New component:** `src/components/products/ProductSurveySheet.tsx`
- One-question-at-a-time wizard, mobile-friendly, single large input per step.
- Steps:
  1. Name *(required)*
  2. Selling price ৳ *(required)*
  3. Stock *(skippable, default 0)*
  4. Labor cost ৳ *(skippable)*
  5. Category *(skippable)*
  6. Materials/recipe — free-text rows: "name + cost" (skippable)
  7. Overheads — multi-select chips from existing overhead pool (skippable)
- Footer: **Back** / **Skip** / **Next** buttons; **Next** disabled on required steps until valid; final step **Continue** opens the existing product form prefilled with all answers for final review & save.
- Progress dots at top. State held locally; user can navigate freely back/forward without losing answers.

**Products page (`src/routes/_authenticated/products.tsx`) buttons:**
- `+ New` → opens the survey (replaces current AI sheet trigger).
- `Manual` → opens the product form directly (current behavior, unchanged).
- Global floating `+` (in `AppShell`/`BottomNav` if it routes here) → also opens the survey.

---

## 2. Free-text recipe rows

In the product form (`ProductSheet`), replace the `<Select>` material dropdown with two text inputs per row: **material name** and **cost per unit (৳)**. No more linking to the `materials` table from this form.

**Data model:** add nullable columns to `product_recipe_items`:
- `material_name text` (used when `material_id` is null)
- `unit_cost_override numeric` (used when `material_id` is null)

Make `material_id` nullable. Server-side cost calc (`computeUnitCost` in `products.functions.ts` and the batch version in `listProducts`) sums:
`qty_per_unit * (materials.avg_unit_cost ?? unit_cost_override)` so existing material-linked rows keep working.

Update `upsertProduct` `RecipeItemSchema` to accept either `{material_id, qty_per_unit}` or `{material_name, unit_cost_override, qty_per_unit:1}`.

Existing Inventory page and material-purchase flow stay untouched — they remain the "proper" way for power users; survey/free-text is the fast path.

---

## 3. Auto-calculated overhead from expenses

**Concept:** Each expense becomes a reusable overhead pool. By default, its cost is amortized across 50 uses (configurable per expense). When a product uses that overhead, `expense.amount / uses_total` is added to the product's overhead.

**Migration:**
- `expenses`: add `uses_total int default 50`, `is_overhead boolean default false`.
- New table `product_overheads (product_id uuid, expense_id uuid, primary key (product_id, expense_id))` with RLS + GRANTs (authenticated CRUD, service_role all).

**Expense form (`Finance` page):** add a checkbox "Use as product overhead" + numeric "Spread over N uses (default 50)".

**Product form:** new section **Overheads used** — multi-select chips listing all `is_overhead = true` expenses; selecting them inserts/deletes rows in `product_overheads`.

**Cost calc:** `unit_cost = materials + labor + manual_overhead + Σ(expense.amount / expense.uses_total for selected overheads)`. Update both `getProduct` and `listProducts`. Keep the existing manual `overhead_cost` field as a fallback/extra.

**Survey step 7** lists these overhead expenses as toggleable chips.

---

## 4. Remove leading "0" in numeric inputs

Across `ProductSheet`, `ProductSurveySheet`, expense forms, and any other numeric input bound to a `number` state initialized at `0`:
- Switch state to `string` (`""` when empty), parse with `Number(v || 0)` on save.
- Render `<Input type="number" value={v} placeholder="100" />` so the field shows a ghost placeholder (e.g. `100`, `15`, `250`) instead of a literal `0` — matching the "type your email…" pattern.
- Apply to: selling price, stock, labor, overhead, recipe qty, material cost, expense amount, uses_total.

---

## 5. Smaller, smoother product form

`ProductSheet` (`products.tsx`):
- Cap height at `max-h-[70vh]`, add a visible drag handle bar at the top, make outer overlay tap-to-close (default Sheet behavior — ensure no `onInteractOutside preventDefault`).
- Defer mounting the form body until `open` is true (`{open && <FormBody/>}`) so it doesn't render in the background — fixes lag.
- Lazy-load the recipe section only after the basic fields are filled (collapse by default with a "Add recipe" toggle), reducing initial paint.
- Replace the inline `useQuery` for full product data with `enabled: open && !!editing?.id` + `staleTime` and skip if survey already passed prefilled data via props.
- Keep current spacing; only collapse the always-visible recipe block and remove the redundant 3-stat summary on small screens (move to a single line).

---

## Technical summary

**Migration:**
```sql
ALTER TABLE public.product_recipe_items
  ALTER COLUMN material_id DROP NOT NULL,
  ADD COLUMN material_name text,
  ADD COLUMN unit_cost_override numeric;

ALTER TABLE public.expenses
  ADD COLUMN uses_total int NOT NULL DEFAULT 50,
  ADD COLUMN is_overhead boolean NOT NULL DEFAULT false;

CREATE TABLE public.product_overheads (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, expense_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_overheads TO authenticated;
GRANT ALL ON public.product_overheads TO service_role;
ALTER TABLE public.product_overheads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rows" ON public.product_overheads
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

**Server functions touched:**
- `products.functions.ts` — schema accepts free-text recipe rows + overhead expense IDs; cost calc updated.
- `finance.functions.ts` — `ExpenseSchema` gains `uses_total`, `is_overhead`; new `listOverheadExpenses`.
- Delete `quick-add.functions.ts` and remove its router registration.

**Components touched/added:**
- ✚ `ProductSurveySheet.tsx`
- ✎ `routes/_authenticated/products.tsx` (button wiring, ProductSheet trimming, placeholder inputs)
- ✎ `routes/_authenticated/finance.tsx` (overhead checkbox + uses_total)
- ✖ `QuickAddSheet.tsx`
- ✎ `AppShell.tsx` / FAB if it currently opens QuickAdd

**Out of scope:** Inventory page, orders, dashboard cost displays continue to work — they read `unit_cost` from the same updated server functions.
