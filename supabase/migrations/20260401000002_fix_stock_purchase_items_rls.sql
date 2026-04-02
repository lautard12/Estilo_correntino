-- The policy on stock_purchase_items used TO public which does not reliably
-- cover authenticated Supabase clients. Recreate scoped to authenticated.
DROP POLICY IF EXISTS "Allow all access to stock_purchase_items" ON public.stock_purchase_items;

CREATE POLICY "Authenticated users can manage stock_purchase_items"
  ON public.stock_purchase_items FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
