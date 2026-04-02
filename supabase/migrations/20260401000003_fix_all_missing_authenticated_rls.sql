-- Several tables were created with RLS policies that omit an explicit role,
-- or use TO public. In Supabase, INSERT/UPDATE/DELETE from the JS client run
-- under the `authenticated` role, so policies must target that role explicitly.
-- This migration normalises all affected tables at once.

-- products
DROP POLICY IF EXISTS "Allow all access to products" ON public.products;
CREATE POLICY "Authenticated users can manage products"
  ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- stock_movements
DROP POLICY IF EXISTS "Allow all access to stock_movements" ON public.stock_movements;
CREATE POLICY "Authenticated users can manage stock_movements"
  ON public.stock_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- categories
DROP POLICY IF EXISTS "Allow all access to categories" ON public.categories;
CREATE POLICY "Authenticated users can manage categories"
  ON public.categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- pos_sales
DROP POLICY IF EXISTS "Allow all access to pos_sales" ON public.pos_sales;
CREATE POLICY "Authenticated users can manage pos_sales"
  ON public.pos_sales FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- pos_sale_items
DROP POLICY IF EXISTS "Allow all access to pos_sale_items" ON public.pos_sale_items;
CREATE POLICY "Authenticated users can manage pos_sale_items"
  ON public.pos_sale_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- pos_payments
DROP POLICY IF EXISTS "Allow all access to pos_payments" ON public.pos_payments;
CREATE POLICY "Authenticated users can manage pos_payments"
  ON public.pos_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- stock_purchases (uses TO public — normalise for consistency)
DROP POLICY IF EXISTS "Allow all access to stock_purchases" ON public.stock_purchases;
CREATE POLICY "Authenticated users can manage stock_purchases"
  ON public.stock_purchases FOR ALL TO authenticated USING (true) WITH CHECK (true);
