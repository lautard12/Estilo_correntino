-- pos_layaways was missed in the batch RLS fix (20260401000003).
-- The original policy had no explicit role, which in Supabase means it does
-- not cover the `authenticated` role used by the JS client → 42501 on INSERT.

DROP POLICY IF EXISTS "Allow all access to pos_layaways" ON public.pos_layaways;
CREATE POLICY "Authenticated users can manage pos_layaways"
  ON public.pos_layaways FOR ALL TO authenticated USING (true) WITH CHECK (true);
