
-- Table: promotions
CREATE TABLE IF NOT EXISTS public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  buy_qty integer NULL,
  get_qty integer NULL,
  percent_off numeric NULL,
  fixed_price integer NULL,
  start_date date NULL,
  end_date date NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: promotion_products
CREATE TABLE IF NOT EXISTS public.promotion_products (
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  PRIMARY KEY (promotion_id, product_id)
);

-- Add promotion_id to pos_sale_items
ALTER TABLE public.pos_sale_items ADD COLUMN IF NOT EXISTS promotion_id uuid NULL;

ALTER TABLE public.pos_sale_items
  ADD CONSTRAINT pos_sale_items_promotion_fk
  FOREIGN KEY (promotion_id) REFERENCES public.promotions(id) ON DELETE SET NULL;

-- RLS for promotions
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read promotions"
  ON public.promotions FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Encargado can manage promotions"
  ON public.promotions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'encargado'::app_role))
  WITH CHECK (has_role(auth.uid(), 'encargado'::app_role));

-- RLS for promotion_products
ALTER TABLE public.promotion_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read promotion_products"
  ON public.promotion_products FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Encargado can manage promotion_products"
  ON public.promotion_products FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'encargado'::app_role))
  WITH CHECK (has_role(auth.uid(), 'encargado'::app_role));
