
-- ============================================================
-- 1) Catálogo tables
-- ============================================================

CREATE TABLE public.product_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type_id uuid REFERENCES public.product_types(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(name, type_id)
);

CREATE TABLE public.variant_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.variant_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id uuid NOT NULL REFERENCES public.variant_sets(id) ON DELETE CASCADE,
  value text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(set_id, value)
);

-- ============================================================
-- 2) Precios y Cobros tables
-- ============================================================

CREATE TABLE public.price_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  label text NOT NULL,
  surcharge_pct numeric NOT NULL DEFAULT 0,
  default_installments int,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  label text NOT NULL,
  fund text NOT NULL,
  commission_pct numeric NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for fund values instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_payment_method_fund()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.fund NOT IN ('EFECTIVO', 'MERCADOPAGO') THEN
    RAISE EXCEPTION 'fund must be EFECTIVO or MERCADOPAGO';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_payment_method_fund
BEFORE INSERT OR UPDATE ON public.payment_methods
FOR EACH ROW EXECUTE FUNCTION public.validate_payment_method_fund();

CREATE TABLE public.term_allowed_methods (
  term_id uuid NOT NULL REFERENCES public.price_terms(id) ON DELETE CASCADE,
  method_id uuid NOT NULL REFERENCES public.payment_methods(id) ON DELETE CASCADE,
  PRIMARY KEY (term_id, method_id)
);

-- ============================================================
-- 3) Add columns to products
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN type_id uuid REFERENCES public.product_types(id),
  ADD COLUMN category_id uuid REFERENCES public.product_categories(id),
  ADD COLUMN variant_set_id uuid REFERENCES public.variant_sets(id),
  ADD COLUMN variant_value_id uuid REFERENCES public.variant_values(id);

-- ============================================================
-- 4) RLS
-- ============================================================

ALTER TABLE public.product_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variant_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variant_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.term_allowed_methods ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated users
CREATE POLICY "Authenticated can read product_types" ON public.product_types FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can read product_categories" ON public.product_categories FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can read variant_sets" ON public.variant_sets FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can read variant_values" ON public.variant_values FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can read price_terms" ON public.price_terms FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can read payment_methods" ON public.payment_methods FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can read term_allowed_methods" ON public.term_allowed_methods FOR SELECT USING (auth.uid() IS NOT NULL);

-- INSERT/UPDATE/DELETE: encargado only
CREATE POLICY "Encargado can manage product_types" ON public.product_types FOR ALL USING (public.has_role(auth.uid(), 'encargado')) WITH CHECK (public.has_role(auth.uid(), 'encargado'));
CREATE POLICY "Encargado can manage product_categories" ON public.product_categories FOR ALL USING (public.has_role(auth.uid(), 'encargado')) WITH CHECK (public.has_role(auth.uid(), 'encargado'));
CREATE POLICY "Encargado can manage variant_sets" ON public.variant_sets FOR ALL USING (public.has_role(auth.uid(), 'encargado')) WITH CHECK (public.has_role(auth.uid(), 'encargado'));
CREATE POLICY "Encargado can manage variant_values" ON public.variant_values FOR ALL USING (public.has_role(auth.uid(), 'encargado')) WITH CHECK (public.has_role(auth.uid(), 'encargado'));
CREATE POLICY "Encargado can manage price_terms" ON public.price_terms FOR ALL USING (public.has_role(auth.uid(), 'encargado')) WITH CHECK (public.has_role(auth.uid(), 'encargado'));
CREATE POLICY "Encargado can manage payment_methods" ON public.payment_methods FOR ALL USING (public.has_role(auth.uid(), 'encargado')) WITH CHECK (public.has_role(auth.uid(), 'encargado'));
CREATE POLICY "Encargado can manage term_allowed_methods" ON public.term_allowed_methods FOR ALL USING (public.has_role(auth.uid(), 'encargado')) WITH CHECK (public.has_role(auth.uid(), 'encargado'));

-- ============================================================
-- 5) Seeds
-- ============================================================

INSERT INTO public.price_terms (code, label, surcharge_pct, default_installments, sort_order) VALUES
  ('BASE', 'Efectivo / Transferencia', 0, NULL, 0),
  ('DEBITO', 'Débito', 0, NULL, 1),
  ('CREDITO_1', 'Crédito 1 cuota', 12, 1, 2),
  ('CREDITO_3', 'Crédito 3 cuotas', 25, 3, 3);

INSERT INTO public.payment_methods (code, label, fund, commission_pct, sort_order) VALUES
  ('EFECTIVO', 'Efectivo', 'EFECTIVO', 0, 0),
  ('TRANSFERENCIA', 'Transferencia', 'MERCADOPAGO', 0, 1),
  ('QR', 'QR', 'MERCADOPAGO', 5, 2),
  ('TARJETA', 'Tarjeta', 'MERCADOPAGO', 0, 3);

-- term_allowed_methods
INSERT INTO public.term_allowed_methods (term_id, method_id)
SELECT pt.id, pm.id FROM public.price_terms pt, public.payment_methods pm
WHERE (pt.code = 'BASE' AND pm.code IN ('EFECTIVO', 'TRANSFERENCIA'))
   OR (pt.code = 'DEBITO' AND pm.code = 'TARJETA')
   OR (pt.code = 'CREDITO_1' AND pm.code = 'TARJETA')
   OR (pt.code = 'CREDITO_3' AND pm.code = 'TARJETA');
