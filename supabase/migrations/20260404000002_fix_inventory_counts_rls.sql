-- inventory_counts and inventory_count_lines were missing explicit TO authenticated
-- on their RLS policies, causing SELECT to return empty rows for the JS client.

DROP POLICY IF EXISTS "Allow all access to inventory_counts" ON public.inventory_counts;
CREATE POLICY "Authenticated users can manage inventory_counts"
  ON public.inventory_counts FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to inventory_count_lines" ON public.inventory_count_lines;
CREATE POLICY "Authenticated users can manage inventory_count_lines"
  ON public.inventory_count_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);
