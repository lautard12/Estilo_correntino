ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS source_stock_movement_id uuid NULL;

CREATE UNIQUE INDEX IF NOT EXISTS expenses_unique_source_stock_movement
ON public.expenses (source_stock_movement_id)
WHERE source_stock_movement_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS expenses_source_stock_movement_idx
ON public.expenses (source_stock_movement_id);