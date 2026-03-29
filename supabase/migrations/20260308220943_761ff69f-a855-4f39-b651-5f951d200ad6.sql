
CREATE OR REPLACE FUNCTION public.get_last_supplier_per_product()
RETURNS TABLE(product_id uuid, supplier_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT DISTINCT ON (sm.product_id)
    sm.product_id,
    s.name AS supplier_name
  FROM stock_movements sm
  JOIN suppliers s ON s.id = sm.supplier_id
  WHERE sm.type = 'PURCHASE' AND sm.supplier_id IS NOT NULL
  ORDER BY sm.product_id, sm.created_at DESC;
$$;
