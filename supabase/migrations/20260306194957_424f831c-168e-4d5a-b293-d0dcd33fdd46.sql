CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to suppliers" ON public.suppliers
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.stock_movements
ADD COLUMN IF NOT EXISTS supplier_id uuid NULL REFERENCES public.suppliers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS stock_movements_supplier_idx ON public.stock_movements (supplier_id);