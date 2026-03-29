
-- Phase 1: Add cost_price to products
ALTER TABLE public.products ADD COLUMN cost_price integer NOT NULL DEFAULT 0;

-- Drop FK from pos_sale_items to restaurant_items before dropping tables
ALTER TABLE public.pos_sale_items DROP CONSTRAINT IF EXISTS pos_sale_items_restaurant_item_id_fkey;

-- Drop FK from restaurant_items to restaurant_categories
ALTER TABLE public.restaurant_items DROP CONSTRAINT IF EXISTS restaurant_items_category_id_fkey;

-- Drop restaurant tables (no longer needed for clothing store)
DROP TABLE IF EXISTS public.restaurant_items;
DROP TABLE IF EXISTS public.restaurant_categories;
