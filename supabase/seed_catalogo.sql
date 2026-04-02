-- ============================================================
-- Seed: Catálogo (tipos, categorías, variantes)
-- Ejecutar en Supabase SQL Editor si ya corriste seed_products.sql
-- ============================================================

DO $$
DECLARE
  t_juegos     uuid;
  t_cuchc      uuid;
  t_cuchm      uuid;
  t_cuchep     uuid;
  t_facones    uuid;
  t_accesorios uuid;
  vs_mango     uuid;
BEGIN

-- Tipos de producto
INSERT INTO public.product_types (name, is_active, sort_order) VALUES
  ('Juegos Parrilleros',   true, 0),
  ('Cuchillos Chicos',     true, 1),
  ('Cuchillos Medianos',   true, 2),
  ('Cuchillos Especiales', true, 3),
  ('Facones y Dagas',      true, 4),
  ('Accesorios',           true, 5)
ON CONFLICT (name) DO NOTHING;

SELECT id INTO t_juegos      FROM public.product_types WHERE name = 'Juegos Parrilleros';
SELECT id INTO t_cuchc       FROM public.product_types WHERE name = 'Cuchillos Chicos';
SELECT id INTO t_cuchm       FROM public.product_types WHERE name = 'Cuchillos Medianos';
SELECT id INTO t_cuchep      FROM public.product_types WHERE name = 'Cuchillos Especiales';
SELECT id INTO t_facones     FROM public.product_types WHERE name = 'Facones y Dagas';
SELECT id INTO t_accesorios  FROM public.product_types WHERE name = 'Accesorios';

-- Categorías
INSERT INTO public.product_categories (name, type_id, is_active, sort_order) VALUES
  ('Juegos',     t_juegos,      true, 0),
  ('Cuchillos',  t_cuchc,       true, 0),
  ('Cuchillos',  t_cuchm,       true, 0),
  ('Cuchillos',  t_cuchep,      true, 0),
  ('Facones',    t_facones,     true, 0),
  ('Dagas',      t_facones,     true, 1),
  ('Afiladores', t_accesorios,  true, 0),
  ('Tablas',     t_accesorios,  true, 1),
  ('Vainas',     t_accesorios,  true, 2)
ON CONFLICT (name, type_id) DO NOTHING;

-- Variantes
INSERT INTO public.variant_sets (name, is_active) VALUES ('Mango', true)
ON CONFLICT (name) DO NOTHING;

SELECT id INTO vs_mango FROM public.variant_sets WHERE name = 'Mango';

INSERT INTO public.variant_values (set_id, value, is_active, sort_order) VALUES
  (vs_mango, 'Madera', true, 0),
  (vs_mango, 'Negro',  true, 1),
  (vs_mango, 'Hueso',  true, 2)
ON CONFLICT (set_id, value) DO NOTHING;

END $$;
