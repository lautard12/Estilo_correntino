
-- Table for purchase headers (merchandise purchases)
CREATE TABLE public.stock_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name_snapshot text NOT NULL DEFAULT '',
  payment_fund text NOT NULL DEFAULT 'EFECTIVO',
  payment_method text NOT NULL DEFAULT 'EFECTIVO',
  total_amount integer NOT NULL DEFAULT 0,
  notes text,
  created_by text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table for purchase line items
CREATE TABLE public.stock_purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.stock_purchases(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  qty integer NOT NULL DEFAULT 0,
  unit_cost integer NOT NULL DEFAULT 0,
  line_total integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_purchase_items ENABLE ROW LEVEL SECURITY;

-- RLS policies - same pattern as other tables for authenticated users
CREATE POLICY "Allow all access to stock_purchases"
  ON public.stock_purchases FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all access to stock_purchase_items"
  ON public.stock_purchase_items FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Add fund validation trigger to stock_purchases
CREATE TRIGGER validate_stock_purchase_fund
  BEFORE INSERT OR UPDATE ON public.stock_purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_payment_method_fund();
