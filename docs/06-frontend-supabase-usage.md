# 06 — Frontend Supabase Usage Inventory

Inventario exacto de todos los archivos que importan o usan Supabase directa o indirectamente.

---

## Archivos que importan `supabase` directamente

Cada archivo importa `import { supabase } from "@/integrations/supabase/client"`.

| Archivo | Funciones/métodos usados | Propósito |
|---|---|---|
| `src/lib/auth-store.ts` | `auth.signInWithPassword`, `auth.signUp`, `auth.signOut`, `auth.getSession`, `auth.onAuthStateChange`, `.from("user_roles").select` | Autenticación y rol |
| `src/hooks/use-auth.tsx` | `auth.getSession`, `auth.onAuthStateChange` | Provider de contexto auth |
| `src/lib/supabase-store.ts` | `.from("products")`, `.from("stock_balances")`, `.from("stock_movements")`, `.from("categories")`, `.from("expenses")`, `.rpc("get_last_supplier_per_product")` | CRUD productos, stock, movimientos, conteo |
| `src/lib/pos-store.ts` | `.from("products")`, `.from("stock_balances")`, `.from("product_prices")`, `.from("pos_sales")`, `.from("pos_sale_items")`, `.from("pos_payments")`, `.from("stock_movements")` | POS: productos activos, crear venta, crear seña |
| `src/lib/finanzas-store.ts` | `.from("pos_sales")`, `.from("pos_payments")`, `.from("pos_sale_items")`, `.from("expenses")`, `.from("fund_movements")`, `.from("cash_opening_balances")` | Finanzas: resultado, capital, gastos |
| `src/lib/cierre-store.ts` | `.from("pos_sales")`, `.from("pos_payments")`, `.from("pos_sale_items")` | Cierre del día: resumen |
| `src/lib/reportes-store.ts` | `.from("pos_sales")`, `.from("pos_sale_items")`, `.from("pos_payments")`, `.from("products")` | Reportes: top productos, ventas por día/método, margen |
| `src/lib/return-store.ts` | `.from("pos_sales")`, `.from("pos_sale_items")`, `.from("pos_payments")`, `.from("profiles")`, `.from("products")`, `.from("stock_movements")`, `.from("stock_balances")`, `.functions.invoke("manage-users")` | Historial ventas + devoluciones |
| `src/lib/layaway-store.ts` | `.from("pos_layaways")`, `.from("pos_sale_items")`, `.from("pos_payments")`, `.from("pos_sales")`, `.from("stock_movements")`, `.from("stock_balances")` | CRUD señas, pagos, cancelación |
| `src/lib/customer-store.ts` | `.from("customers")` | CRUD clientes |
| `src/lib/customer-stats-store.ts` | `.from("pos_sales")`, `.from("customers")`, `.from("pos_sale_items")` | Estadísticas de clientes |
| `src/lib/config-store.ts` | `.from("product_types")`, `.from("product_categories")`, `.from("variant_sets")`, `.from("variant_values")`, `.from("price_terms")` | CRUD configuración catálogo |
| `src/lib/price-store.ts` | `.from("price_settings")`, `.from("product_prices")` | CRUD precios |
| `src/lib/promotions-store.ts` | `.from("promotions")`, `.from("promotion_products")`, `.from("products")`, `.from("stock_balances")`, `.from("product_prices")` | CRUD promociones + cálculo descuentos |
| `src/lib/supplier-store.ts` | `.from("suppliers")`, `.from("stock_movements")` | CRUD proveedores + historial compras |
| `src/lib/weekly-count-store.ts` | `.from("inventory_counts")`, `.from("inventory_count_lines")`, `.from("stock_movements")`, `.from("stock_balances")`, `.from("products")` | Conteo semanal de inventario |
| `src/pages/Usuarios.tsx` | `.functions.invoke("manage-users")` | Gestión de usuarios |
| `src/pages/MiCuenta.tsx` | `auth.updateUser` | Cambio de contraseña |
| `src/pages/CierreDelDia.tsx` | `.from("pos_sales")`, `.from("pos_payments")`, `.from("pos_sale_items")` | Queries inline para modo semana |
| `src/components/product/CreditSettings.tsx` | `.from(...)` — no verificado en detalle | Configuración de crédito |
| `src/components/config/OfertasTab.tsx` | `.from("products")` | Selector de productos para ofertas |

---

## Archivos que usan Supabase indirectamente (via stores)

| Archivo | Store(s) importados |
|---|---|
| `src/pages/Stock.tsx` | `supabase-store` (fetchProductsWithStock, fetchMovements, addMovement, applyCount, fetchCategories) |
| `src/pages/Products.tsx` | `supabase-store` (fetchAllProducts, addProduct, updateProduct, toggleProduct, duplicateProduct, deleteProduct), `price-store`, `config-store` |
| `src/pages/POS.tsx` | `pos-store`, `config-store`, `promotions-store`, `customer-store` |
| `src/pages/Ventas.tsx` | `return-store` |
| `src/pages/Senas.tsx` | `layaway-store` |
| `src/pages/CierreDelDia.tsx` | `cierre-store` (+ inline supabase) |
| `src/pages/Finanzas.tsx` | `finanzas-store` |
| `src/pages/Reportes.tsx` | `reportes-store` |
| `src/pages/Clientes.tsx` | `customer-store`, `customer-stats-store` |
| `src/pages/Configuracion.tsx` | (via sub-components: CatalogoTab, PreciosTab, AccesosTab, OfertasTab → config-store, promotions-store) |
| `src/pages/Auth.tsx` | `auth-store` |
| `src/components/clientes/ClientesStats.tsx` | `customer-stats-store` |
| `src/components/pos/CustomerSelector.tsx` | `customer-store` |
| `src/components/pos/OffersSheet.tsx` | `promotions-store` |
| `src/components/stock/StockActionModal.tsx` | `supabase-store`, `supplier-store` |
| `src/components/stock/WeeklyCountMode.tsx` | `weekly-count-store` |
| `src/components/stock/ProductPurchaseHistory.tsx` | `supplier-store` |
| `src/components/product/PriceDrawer.tsx` | `price-store` |
| `src/components/product/SuppliersDrawer.tsx` | `supplier-store` |

---

## Archivos Supabase auto-generados (NO editar)

| Archivo | Contenido |
|---|---|
| `src/integrations/supabase/client.ts` | Instancia de `createClient<Database>` |
| `src/integrations/supabase/types.ts` | Tipos TypeScript generados del schema |

---

## Resumen de dependencias Supabase por feature

| Feature | Archivos store | Tablas | Auth | Edge Fn | RPC |
|---|---|---|---|---|---|
| Auth | auth-store, use-auth | user_roles, profiles | ✅ signIn/signOut/getSession/onAuthStateChange | — | — |
| Stock | supabase-store | products, stock_balances, stock_movements, categories, expenses | — | — | get_last_supplier_per_product |
| Products | supabase-store, price-store, config-store | products, stock_balances, product_prices, price_settings, product_types, product_categories, variant_sets, variant_values, price_terms | — | — | — |
| POS | pos-store, promotions-store | products, stock_balances, product_prices, pos_sales, pos_sale_items, pos_payments, stock_movements, promotions, promotion_products | — | — | — |
| Señas | layaway-store | pos_layaways, pos_sale_items, pos_payments, pos_sales, stock_movements, stock_balances | — | — | — |
| Ventas | return-store | pos_sales, pos_sale_items, pos_payments, profiles, products, stock_movements, stock_balances | — | manage-users | — |
| Cierre | cierre-store | pos_sales, pos_payments, pos_sale_items | — | — | — |
| Finanzas | finanzas-store | pos_sales, pos_payments, pos_sale_items, products, expenses, fund_movements, cash_opening_balances | — | — | — |
| Reportes | reportes-store | pos_sales, pos_sale_items, pos_payments, products | — | — | — |
| Clientes | customer-store, customer-stats-store | customers, pos_sales, pos_sale_items | — | — | — |
| Usuarios | — (inline) | — (via edge function) | — | manage-users | — |
| Config | config-store, promotions-store | product_types, product_categories, variant_sets, variant_values, price_terms, promotions, promotion_products | — | — | — |
| Proveedores | supplier-store | suppliers, stock_movements | — | — | — |
| Conteo | weekly-count-store | inventory_counts, inventory_count_lines, stock_movements, stock_balances, products | — | — | — |
| Mi Cuenta | — (inline) | — | ✅ auth.updateUser | — | — |
