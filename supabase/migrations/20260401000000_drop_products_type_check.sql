-- The products.type text column had a hardcoded CHECK constraint from earlier iterations
-- of the schema. The system now uses the product_types table + type_id FK for classification,
-- so the constraint on the free-text type column is no longer valid.
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_type_check;
