
ALTER TABLE public.product_recipe_items
  ALTER COLUMN material_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS material_name text,
  ADD COLUMN IF NOT EXISTS unit_cost_override numeric;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS uses_total integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS is_overhead boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.product_overheads (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, expense_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_overheads TO authenticated;
GRANT ALL ON public.product_overheads TO service_role;

ALTER TABLE public.product_overheads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own product_overheads"
  ON public.product_overheads
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
