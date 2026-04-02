-- ============================================================
-- Seed: Productos de prueba - Estilo Correntino
-- Ejecutar en Supabase SQL Editor
-- ============================================================
-- Precios: LOCAL y ONLINE × EFECTIVO / CREDITO_1 (+12%) / CREDITO_3 (+25%)
-- ============================================================

DO $$
DECLARE
  p uuid;
  t_juegos    uuid;
  t_cuchc     uuid;
  t_cuchm     uuid;
  t_cuchep    uuid;
  t_facones   uuid;
  t_accesorios uuid;
  vs_mango    uuid;
BEGIN

-- ============================================================
-- CATÁLOGO: Tipos de producto
-- ============================================================
INSERT INTO public.product_types (name, is_active, sort_order) VALUES
  ('Juegos Parrilleros', true, 0),
  ('Cuchillos Chicos',   true, 1),
  ('Cuchillos Medianos', true, 2),
  ('Cuchillos Especiales', true, 3),
  ('Facones y Dagas',    true, 4),
  ('Accesorios',         true, 5)
ON CONFLICT (name) DO NOTHING;

SELECT id INTO t_juegos    FROM public.product_types WHERE name = 'Juegos Parrilleros';
SELECT id INTO t_cuchc     FROM public.product_types WHERE name = 'Cuchillos Chicos';
SELECT id INTO t_cuchm     FROM public.product_types WHERE name = 'Cuchillos Medianos';
SELECT id INTO t_cuchep    FROM public.product_types WHERE name = 'Cuchillos Especiales';
SELECT id INTO t_facones   FROM public.product_types WHERE name = 'Facones y Dagas';
SELECT id INTO t_accesorios FROM public.product_types WHERE name = 'Accesorios';

-- ============================================================
-- CATÁLOGO: Categorías
-- ============================================================
INSERT INTO public.product_categories (name, type_id, is_active, sort_order) VALUES
  ('Juegos',     t_juegos,     true, 0),
  ('Cuchillos',  t_cuchc,      true, 0),
  ('Cuchillos',  t_cuchm,      true, 0),
  ('Cuchillos',  t_cuchep,     true, 0),
  ('Facones',    t_facones,    true, 0),
  ('Dagas',      t_facones,    true, 1),
  ('Afiladores', t_accesorios, true, 0),
  ('Tablas',     t_accesorios, true, 1),
  ('Vainas',     t_accesorios, true, 2)
ON CONFLICT (name, type_id) DO NOTHING;

-- ============================================================
-- CATÁLOGO: Variantes
-- ============================================================
INSERT INTO public.variant_sets (name, is_active) VALUES ('Mango', true)
ON CONFLICT (name) DO NOTHING;

SELECT id INTO vs_mango FROM public.variant_sets WHERE name = 'Mango';

INSERT INTO public.variant_values (set_id, value, is_active, sort_order) VALUES
  (vs_mango, 'Madera', true, 0),
  (vs_mango, 'Negro',  true, 1),
  (vs_mango, 'Hueso',  true, 2)
ON CONFLICT (set_id, value) DO NOTHING;

-- ─── CUCHILLOS CHICOS ────────────────────────────────────────

INSERT INTO public.products (name, type, category, variant_label, sku, min_stock, track_stock, is_active, cost_price)
VALUES ('Cuchillo de Mesa Chico Mango Madera', 'CUCHILLOS_CHICOS', 'Cuchillos', 'Mango Madera', 'CUC-CH-001', 3, true, true, 3500)
RETURNING id INTO p;
INSERT INTO public.stock_balances (product_id, qty_on_hand) VALUES (p, 15);
INSERT INTO public.product_prices (product_id, channel, term, price) VALUES
  (p, 'LOCAL',  'EFECTIVO',  6500), (p, 'LOCAL',  'CREDITO_1', 7280), (p, 'LOCAL',  'CREDITO_3', 8125),
  (p, 'ONLINE', 'EFECTIVO',  7000), (p, 'ONLINE', 'CREDITO_1', 7840), (p, 'ONLINE', 'CREDITO_3', 8750);

INSERT INTO public.products (name, type, category, variant_label, sku, min_stock, track_stock, is_active, cost_price)
VALUES ('Cuchillo de Mesa Chico Mango Negro', 'CUCHILLOS_CHICOS', 'Cuchillos', 'Mango Negro', 'CUC-CH-002', 3, true, true, 3200)
RETURNING id INTO p;
INSERT INTO public.stock_balances (product_id, qty_on_hand) VALUES (p, 20);
INSERT INTO public.product_prices (product_id, channel, term, price) VALUES
  (p, 'LOCAL',  'EFECTIVO',  6000), (p, 'LOCAL',  'CREDITO_1', 6720), (p, 'LOCAL',  'CREDITO_3', 7500),
  (p, 'ONLINE', 'EFECTIVO',  6500), (p, 'ONLINE', 'CREDITO_1', 7280), (p, 'ONLINE', 'CREDITO_3', 8125);

INSERT INTO public.products (name, type, category, variant_label, sku, min_stock, track_stock, is_active, cost_price)
VALUES ('Cuchillo Fileteador Chico', 'CUCHILLOS_CHICOS', 'Cuchillos', '', 'CUC-CH-003', 2, true, true, 4000)
RETURNING id INTO p;
INSERT INTO public.stock_balances (product_id, qty_on_hand) VALUES (p, 10);
INSERT INTO public.product_prices (product_id, channel, term, price) VALUES
  (p, 'LOCAL',  'EFECTIVO',  8000), (p, 'LOCAL',  'CREDITO_1', 8960), (p, 'LOCAL',  'CREDITO_3', 10000),
  (p, 'ONLINE', 'EFECTIVO',  8500), (p, 'ONLINE', 'CREDITO_1', 9520), (p, 'ONLINE', 'CREDITO_3', 10625);

-- ─── CUCHILLOS MEDIANOS ───────────────────────────────────────

INSERT INTO public.products (name, type, category, variant_label, sku, min_stock, track_stock, is_active, cost_price)
VALUES ('Cuchillo Asado Mediano Mango Madera', 'CUCHILLOS_MEDIANOS', 'Cuchillos', 'Mango Madera', 'CUC-MD-001', 2, true, true, 7000)
RETURNING id INTO p;
INSERT INTO public.stock_balances (product_id, qty_on_hand) VALUES (p, 12);
INSERT INTO public.product_prices (product_id, channel, term, price) VALUES
  (p, 'LOCAL',  'EFECTIVO',  14000), (p, 'LOCAL',  'CREDITO_1', 15680), (p, 'LOCAL',  'CREDITO_3', 17500),
  (p, 'ONLINE', 'EFECTIVO',  15000), (p, 'ONLINE', 'CREDITO_1', 16800), (p, 'ONLINE', 'CREDITO_3', 18750);

INSERT INTO public.products (name, type, category, variant_label, sku, min_stock, track_stock, is_active, cost_price)
VALUES ('Cuchillo Carnicero Mediano', 'CUCHILLOS_MEDIANOS', 'Cuchillos', '', 'CUC-MD-002', 2, true, true, 8500)
RETURNING id INTO p;
INSERT INTO public.stock_balances (product_id, qty_on_hand) VALUES (p, 8);
INSERT INTO public.product_prices (product_id, channel, term, price) VALUES
  (p, 'LOCAL',  'EFECTIVO',  17000), (p, 'LOCAL',  'CREDITO_1', 19040), (p, 'LOCAL',  'CREDITO_3', 21250),
  (p, 'ONLINE', 'EFECTIVO',  18000), (p, 'ONLINE', 'CREDITO_1', 20160), (p, 'ONLINE', 'CREDITO_3', 22500);

-- ─── CUCHILLOS ESPECIALES ─────────────────────────────────────

INSERT INTO public.products (name, type, category, variant_label, sku, min_stock, track_stock, is_active, cost_price)
VALUES ('Cuchillo Campero Hoja Ancha', 'CUCHILLOS_ESPECIALES', 'Cuchillos', '', 'CUC-ESP-001', 1, true, true, 14000)
RETURNING id INTO p;
INSERT INTO public.stock_balances (product_id, qty_on_hand) VALUES (p, 6);
INSERT INTO public.product_prices (product_id, channel, term, price) VALUES
  (p, 'LOCAL',  'EFECTIVO',  28000), (p, 'LOCAL',  'CREDITO_1', 31360), (p, 'LOCAL',  'CREDITO_3', 35000),
  (p, 'ONLINE', 'EFECTIVO',  30000), (p, 'ONLINE', 'CREDITO_1', 33600), (p, 'ONLINE', 'CREDITO_3', 37500);

INSERT INTO public.products (name, type, category, variant_label, sku, min_stock, track_stock, is_active, cost_price)
VALUES ('Cuchillo Corvo Gauchesco', 'CUCHILLOS_ESPECIALES', 'Cuchillos', '', 'CUC-ESP-002', 1, true, true, 16000)
RETURNING id INTO p;
INSERT INTO public.stock_balances (product_id, qty_on_hand) VALUES (p, 4);
INSERT INTO public.product_prices (product_id, channel, term, price) VALUES
  (p, 'LOCAL',  'EFECTIVO',  32000), (p, 'LOCAL',  'CREDITO_1', 35840), (p, 'LOCAL',  'CREDITO_3', 40000),
  (p, 'ONLINE', 'EFECTIVO',  34000), (p, 'ONLINE', 'CREDITO_1', 38080), (p, 'ONLINE', 'CREDITO_3', 42500);

-- ─── JUEGOS PARRILLEROS ───────────────────────────────────────

INSERT INTO public.products (name, type, category, variant_label, sku, min_stock, track_stock, is_active, cost_price)
VALUES ('Juego Parrillero 4 Piezas Mango Madera', 'JUEGOS_PARRILLEROS', 'Juegos', 'Mango Madera', 'JP-004-MAD', 1, true, true, 22000)
RETURNING id INTO p;
INSERT INTO public.stock_balances (product_id, qty_on_hand) VALUES (p, 7);
INSERT INTO public.product_prices (product_id, channel, term, price) VALUES
  (p, 'LOCAL',  'EFECTIVO',  45000), (p, 'LOCAL',  'CREDITO_1', 50400), (p, 'LOCAL',  'CREDITO_3', 56250),
  (p, 'ONLINE', 'EFECTIVO',  48000), (p, 'ONLINE', 'CREDITO_1', 53760), (p, 'ONLINE', 'CREDITO_3', 60000);

INSERT INTO public.products (name, type, category, variant_label, sku, min_stock, track_stock, is_active, cost_price)
VALUES ('Juego Parrillero 6 Piezas Mango Madera', 'JUEGOS_PARRILLEROS', 'Juegos', 'Mango Madera', 'JP-006-MAD', 1, true, true, 35000)
RETURNING id INTO p;
INSERT INTO public.stock_balances (product_id, qty_on_hand) VALUES (p, 5);
INSERT INTO public.product_prices (product_id, channel, term, price) VALUES
  (p, 'LOCAL',  'EFECTIVO',  70000), (p, 'LOCAL',  'CREDITO_1', 78400), (p, 'LOCAL',  'CREDITO_3', 87500),
  (p, 'ONLINE', 'EFECTIVO',  75000), (p, 'ONLINE', 'CREDITO_1', 84000), (p, 'ONLINE', 'CREDITO_3', 93750);

INSERT INTO public.products (name, type, category, variant_label, sku, min_stock, track_stock, is_active, cost_price)
VALUES ('Juego Parrillero 6 Piezas Mango Negro', 'JUEGOS_PARRILLEROS', 'Juegos', 'Mango Negro', 'JP-006-NEG', 1, true, true, 33000)
RETURNING id INTO p;
INSERT INTO public.stock_balances (product_id, qty_on_hand) VALUES (p, 4);
INSERT INTO public.product_prices (product_id, channel, term, price) VALUES
  (p, 'LOCAL',  'EFECTIVO',  65000), (p, 'LOCAL',  'CREDITO_1', 72800), (p, 'LOCAL',  'CREDITO_3', 81250),
  (p, 'ONLINE', 'EFECTIVO',  70000), (p, 'ONLINE', 'CREDITO_1', 78400), (p, 'ONLINE', 'CREDITO_3', 87500);

-- ─── FACONES Y DAGAS ─────────────────────────────────────────

INSERT INTO public.products (name, type, category, variant_label, sku, min_stock, track_stock, is_active, cost_price)
VALUES ('Facón Gauchesco Mango Hueso', 'FACONES_Y_DAGAS', 'Facones', 'Mango Hueso', 'FAC-HUE-001', 1, true, true, 18000)
RETURNING id INTO p;
INSERT INTO public.stock_balances (product_id, qty_on_hand) VALUES (p, 5);
INSERT INTO public.product_prices (product_id, channel, term, price) VALUES
  (p, 'LOCAL',  'EFECTIVO',  36000), (p, 'LOCAL',  'CREDITO_1', 40320), (p, 'LOCAL',  'CREDITO_3', 45000),
  (p, 'ONLINE', 'EFECTIVO',  38000), (p, 'ONLINE', 'CREDITO_1', 42560), (p, 'ONLINE', 'CREDITO_3', 47500);

INSERT INTO public.products (name, type, category, variant_label, sku, min_stock, track_stock, is_active, cost_price)
VALUES ('Daga Artesanal Hoja 25cm', 'FACONES_Y_DAGAS', 'Dagas', '', 'DAG-001', 1, true, true, 20000)
RETURNING id INTO p;
INSERT INTO public.stock_balances (product_id, qty_on_hand) VALUES (p, 3);
INSERT INTO public.product_prices (product_id, channel, term, price) VALUES
  (p, 'LOCAL',  'EFECTIVO',  40000), (p, 'LOCAL',  'CREDITO_1', 44800), (p, 'LOCAL',  'CREDITO_3', 50000),
  (p, 'ONLINE', 'EFECTIVO',  43000), (p, 'ONLINE', 'CREDITO_1', 48160), (p, 'ONLINE', 'CREDITO_3', 53750);

-- ─── ACCESORIOS ───────────────────────────────────────────────

INSERT INTO public.products (name, type, category, variant_label, sku, min_stock, track_stock, is_active, cost_price)
VALUES ('Afilador de Cuchillos Piedra', 'ACCESORIOS', 'Afiladores', '', 'ACC-AFI-001', 3, true, true, 2500)
RETURNING id INTO p;
INSERT INTO public.stock_balances (product_id, qty_on_hand) VALUES (p, 25);
INSERT INTO public.product_prices (product_id, channel, term, price) VALUES
  (p, 'LOCAL',  'EFECTIVO',  5000), (p, 'LOCAL',  'CREDITO_1', 5600), (p, 'LOCAL',  'CREDITO_3', 6250),
  (p, 'ONLINE', 'EFECTIVO',  5500), (p, 'ONLINE', 'CREDITO_1', 6160), (p, 'ONLINE', 'CREDITO_3', 6875);

INSERT INTO public.products (name, type, category, variant_label, sku, min_stock, track_stock, is_active, cost_price)
VALUES ('Tabla de Madera para Asado', 'ACCESORIOS', 'Tablas', '', 'ACC-TAB-001', 2, true, true, 5000)
RETURNING id INTO p;
INSERT INTO public.stock_balances (product_id, qty_on_hand) VALUES (p, 10);
INSERT INTO public.product_prices (product_id, channel, term, price) VALUES
  (p, 'LOCAL',  'EFECTIVO',  10000), (p, 'LOCAL',  'CREDITO_1', 11200), (p, 'LOCAL',  'CREDITO_3', 12500),
  (p, 'ONLINE', 'EFECTIVO',  11000), (p, 'ONLINE', 'CREDITO_1', 12320), (p, 'ONLINE', 'CREDITO_3', 13750);

INSERT INTO public.products (name, type, category, variant_label, sku, min_stock, track_stock, is_active, cost_price)
VALUES ('Vaina de Cuero para Cuchillo', 'ACCESORIOS', 'Vainas', '', 'ACC-VAI-001', 2, true, true, 3000)
RETURNING id INTO p;
INSERT INTO public.stock_balances (product_id, qty_on_hand) VALUES (p, 18);
INSERT INTO public.product_prices (product_id, channel, term, price) VALUES
  (p, 'LOCAL',  'EFECTIVO',  6000), (p, 'LOCAL',  'CREDITO_1', 6720), (p, 'LOCAL',  'CREDITO_3', 7500),
  (p, 'ONLINE', 'EFECTIVO',  6500), (p, 'ONLINE', 'CREDITO_1', 7280), (p, 'ONLINE', 'CREDITO_3', 8125);

END $$;
