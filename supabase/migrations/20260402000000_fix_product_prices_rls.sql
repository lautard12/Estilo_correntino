-- product_prices and price_settings were created with policies that omit an
-- explicit role, defaulting to `public`. Supabase JS client runs as
-- `authenticated`, so INSERT/UPDATE/DELETE were blocked by RLS.

DROP POLICY IF EXISTS "Allow all access to product_prices" ON public.product_prices;
CREATE POLICY "Authenticated users can manage product_prices"
  ON public.product_prices FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to price_settings" ON public.price_settings;
CREATE POLICY "Authenticated users can manage price_settings"
  ON public.price_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
