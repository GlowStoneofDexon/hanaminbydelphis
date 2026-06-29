ALTER TABLE public.materials DROP COLUMN IF EXISTS low_threshold;
ALTER TABLE public.expenses DROP COLUMN IF EXISTS is_overhead;
ALTER TABLE public.expenses DROP COLUMN IF EXISTS uses_total;
DROP TABLE IF EXISTS public.product_overheads;