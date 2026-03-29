
CREATE TABLE public.fund_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  fund text NOT NULL,
  amount integer NOT NULL,
  type text NOT NULL DEFAULT 'INGRESO',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL DEFAULT 'admin'
);

ALTER TABLE public.fund_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to fund_movements" ON public.fund_movements
  FOR ALL USING (true) WITH CHECK (true);
