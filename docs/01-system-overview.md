# 01 — System Overview

## Resumen funcional

**Estilo Correntino** es un sistema de gestión comercial para un local de venta de artículos de cuchillería y parrilla. Cubre punto de venta (POS), gestión de inventario, finanzas, reportes, clientes, señas (layaways), y administración de usuarios.

El frontend es una SPA React (Vite + TypeScript + Tailwind) que se conecta directamente a Supabase (PostgreSQL + Auth + Edge Functions) sin capa de API REST intermedia.

---

## Listado de pantallas

| Ruta               | Componente         | Descripción                                      | Auth requerida |
|--------------------|--------------------|--------------------------------------------------|----------------|
| `/auth`            | `Auth.tsx`         | Login (solo sign-in, no registro público)         | No             |
| `/stock`           | `Stock.tsx`        | Inventario: stock actual, compras, conteo         | Sí             |
| `/products`        | `Products.tsx`     | ABM de productos, precios, proveedores            | Sí             |
| `/caja`            | `POS.tsx`          | Punto de venta: carrito, checkout, ofertas         | Sí             |
| `/senas`           | `Senas.tsx`        | Gestión de señas (layaways): pagos parciales       | Sí             |
| `/ventas`          | `Ventas.tsx`       | Historial de ventas, devoluciones                  | Sí             |
| `/cierre-del-dia`  | `CierreDelDia.tsx` | Cierre diario/semanal: resumen de cobros           | Sí             |
| `/finanzas`        | `Finanzas.tsx`     | Resultado, gastos, capital por fondo               | Sí             |
| `/reportes`        | `Reportes.tsx`     | Gráficos: ventas por día, método, margen           | Sí             |
| `/clientes`        | `Clientes.tsx`     | ABM de clientes + estadísticas de compra           | Sí             |
| `/usuarios`        | `Usuarios.tsx`     | Gestión de usuarios (solo encargado)               | Sí (encargado) |
| `/configuracion`   | `Configuracion.tsx`| Catálogo, precios, ofertas, accesos                | Sí (encargado) |
| `/mi-cuenta`       | `MiCuenta.tsx`     | Ver info propia, cambiar contraseña                | Sí             |

---

## Flujo principal por pantalla

### Auth
1. Usuario ingresa email + contraseña
2. `signInWithPassword` contra Supabase Auth
3. Redirige a `/stock`

### Stock
1. Carga productos activos con balance de stock (join `products` + `stock_balances` + RPC `get_last_supplier_per_product`)
2. Filtros por categoría, tipo, stock bajo
3. Acciones: registrar compra (con gasto opcional), merma, ajuste manual
4. Modo conteo semanal: crear/editar/aplicar conteo de inventario (`inventory_counts` + `inventory_count_lines`)

### Products
1. Lista todos los productos (activos e inactivos)
2. CRUD: crear, editar, duplicar, eliminar, toggle activo
3. Gestión de precios por canal/término (`product_prices`)
4. Gestión de proveedores (`suppliers`)
5. Configuración de crédito (`price_settings`)

### POS (Caja)
1. Selecciona canal (LOCAL/ONLINE) y término de precio
2. Busca productos, agrega al carrito
3. Opcionalmente aplica ofertas/promociones
4. Selecciona cliente (opcional)
5. Checkout: define medios de pago, confirma
6. Crea `pos_sales` + `pos_sale_items` + `pos_payments` + descuenta stock

### Señas
1. Lista señas pendientes/completadas/canceladas (`pos_layaways`)
2. Registrar pago parcial → actualiza `paid`, `balance`, inserta `pos_payments`
3. Cancelar seña → restaura stock

### Ventas
1. Lista últimas ventas completadas con detalle financiero (bruto, comisiones, neto, COGS, margen)
2. Filtros por vendedor, método de pago, fecha, hora
3. Ver detalle de venta
4. Procesar devolución → restaura stock

### Cierre del día
1. Selecciona fecha o semana
2. Muestra total cobrado, desglose por método de pago y por fondo
3. Detalle de productos vendidos

### Finanzas
1. **Resultado**: facturado - comisiones - COGS - gastos = ganancia neta (por día)
2. **Gastos**: CRUD de gastos operativos, desglose por categoría
3. **Capital**: saldo por fondo (EFECTIVO/MERCADOPAGO), saldo inicial, movimientos

### Reportes
1. Ventas por día (bar chart)
2. Ventas por método de pago (pie chart)
3. Margen por categoría (bar chart horizontal)
4. Top productos (tabla)

### Clientes
1. **Lista**: ABM de clientes (nombre, teléfono, email, documento, dirección)
2. **Estadísticas**: ranking por gasto, detalle por cliente con productos más comprados y gasto mensual

### Usuarios
1. Lista usuarios del sistema (via edge function `manage-users`)
2. Crear usuario con rol (vendedor/encargado)
3. Cambiar rol, eliminar usuario, resetear contraseña

### Configuración (solo encargado)
1. **Catálogo**: tipos, categorías, sets de variante
2. **Precios**: términos de pago (code, label, surcharge, fund)
3. **Ofertas**: CRUD de promociones (BUY_X_GET_Y, PERCENT_OFF, FIXED_PRICE)
4. **Accesos**: auditoría (audit_log)

### Mi Cuenta
1. Muestra email y rol del usuario
2. Cambiar contraseña (`supabase.auth.updateUser`)

---

## Mapa pantalla → tablas → operaciones → auth

| Pantalla      | Tablas involucradas                                                      | Operaciones principales                  | Rol requerido  |
|---------------|--------------------------------------------------------------------------|------------------------------------------|----------------|
| Auth          | —                                                                        | `auth.signInWithPassword`                | Ninguno        |
| Stock         | products, stock_balances, stock_movements, categories, suppliers, expenses, inventory_counts, inventory_count_lines | SELECT, INSERT, UPDATE, UPSERT, RPC      | authenticated  |
| Products      | products, stock_balances, product_prices, product_types, product_categories, variant_sets, variant_values, suppliers, price_settings, price_terms | SELECT, INSERT, UPDATE, DELETE            | authenticated (write: encargado para catálogo) |
| POS           | products, stock_balances, product_prices, pos_sales, pos_sale_items, pos_payments, stock_movements, promotions, promotion_products, price_terms, customers | SELECT, INSERT, UPDATE                   | authenticated  |
| Señas         | pos_layaways, pos_sale_items, pos_payments, pos_sales, stock_movements, stock_balances | SELECT, INSERT, UPDATE                   | authenticated  |
| Ventas        | pos_sales, pos_sale_items, pos_payments, profiles, products, stock_movements, stock_balances | SELECT, INSERT, UPDATE, edge function    | authenticated  |
| Cierre        | pos_sales, pos_payments, pos_sale_items                                  | SELECT                                   | authenticated  |
| Finanzas      | pos_sales, pos_payments, pos_sale_items, products, expenses, fund_movements, cash_opening_balances | SELECT, INSERT, UPDATE, DELETE            | authenticated  |
| Reportes      | pos_sales, pos_sale_items, pos_payments, products                        | SELECT                                   | authenticated  |
| Clientes      | customers, pos_sales, pos_sale_items                                     | SELECT, INSERT, UPDATE (soft-delete)      | authenticated (update/delete: encargado) |
| Usuarios      | — (edge function `manage-users`)                                          | Edge function invoke                      | encargado      |
| Configuración | product_types, product_categories, variant_sets, variant_values, price_terms, promotions, promotion_products, audit_log, products | SELECT, INSERT, UPDATE, DELETE            | encargado      |
| Mi Cuenta     | —                                                                        | `auth.updateUser`                        | authenticated  |
