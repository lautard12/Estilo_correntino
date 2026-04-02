-- The original policy on stock_balances did not specify a role, which can cause
-- RLS violations when the authenticated client attempts to insert rows.
-- Recreate it explicitly scoped to the authenticated role.
DROP POLICY IF EXISTS "Allow all access to stock_balances" ON public.stock_balances;

CREATE POLICY "Authenticated users can manage stock_balances"
  ON public.stock_balances FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
