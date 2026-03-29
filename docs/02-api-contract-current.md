# 02 — API Contract (Current)

Inventario completo de operaciones de datos que realiza el frontend. Para cada operación se indica el contrato HTTP ideal que debería reemplazarla.

---

## Convenciones

- **Método actual**: forma en que el frontend ejecuta la operación hoy (Supabase JS SDK)
- **Contrato HTTP ideal**: endpoint REST que reemplazaría la operación
- **Auth**: si requiere token de autenticación

---

## 1. Autenticación (`src/lib/auth-store.ts`, `src/hooks/use-auth.tsx`)

### 1.1 Sign In
| Campo | Valor |
|---|---|
| Pantalla | Auth |
| Objetivo | Iniciar sesión |
| Recurso | `auth.signInWithPassword` |
| Método actual | Supabase Auth SDK |
| Entrada | `{ email: string, password: string }` |
| Respuesta | `{ session: Session, user: User }` |
| Errores | `Invalid login credentials` |
| **HTTP ideal** | `POST /api/auth/login` → `{ token, user }` |

### 1.2 Sign Out
| Campo | Valor |
|---|---|
| Pantalla | Sidebar |
| Método actual | `supabase.auth.signOut()` |
| **HTTP ideal** | `POST /api/auth/logout` |

### 1.3 Get Session
| Campo | Valor |
|---|---|
| Pantalla | App (init) |
| Método actual | `supabase.auth.getSession()` |
| **HTTP ideal** | `GET /api/auth/session` → `{ user, role }` |

### 1.4 On Auth Change
| Campo | Valor |
|---|---|
| Pantalla | App (listener) |
| Método actual | `supabase.auth.onAuthStateChange` |
| **HTTP ideal** | N/A — se reemplazaría por polling o verificación de token en cada request |

### 1.5 Fetch User Role
| Campo | Valor |
|---|---|
| Pantalla | App (init) |
| Método actual | `SELECT role FROM user_roles WHERE user_id = $1 LIMIT 1` |
| **HTTP ideal** | `GET /api/auth/me` → `{ user, role }` (incluir en sesión) |

### 1.6 Update Password
| Campo | Valor |
|---|---|
| Pantalla | Mi Cuenta |
| Método actual | `supabase.auth.updateUser({ password })` |
| **HTTP ideal** | `PUT /api/auth/password` body `{ new_password }` |

---

## 2. Productos (`src/lib/supabase-store.ts`, `src/pages/Products.tsx`)

### 2.1 Fetch Products With Stock
| Campo | Valor |
|---|---|
| Pantalla | Stock |
| Método actual | `SELECT *, stock_balances(qty_on_hand) FROM products WHERE is_active = true` + RPC `get_last_supplier_per_product` |
| Entrada | — |
| Respuesta | `ProductWithStock[]` (product + qty_on_hand + status + last_supplier) |
| **HTTP ideal** | `GET /api/products?with_stock=true&active=true` |

### 2.2 Fetch All Products
| Campo | Valor |
|---|---|
| Pantalla | Products |
| Método actual | `SELECT * FROM products ORDER BY created_at DESC` |
| **HTTP ideal** | `GET /api/products?all=true` |

### 2.3 Add Product
| Campo | Valor |
|---|---|
| Pantalla | Products |
| Método actual | `INSERT INTO products` + `INSERT INTO stock_balances` |
| Entrada | `{ name, type, category, variant_label, sku, min_stock, track_stock, is_active, cost_price, type_id, category_id, variant_set_id, variant_value_id }` |
| **HTTP ideal** | `POST /api/products` |

### 2.4 Update Product
| Campo | Valor |
|---|---|
| Pantalla | Products |
| Método actual | `UPDATE products SET ... WHERE id = $1` |
| **HTTP ideal** | `PUT /api/products/:id` |

### 2.5 Toggle Product Active
| Campo | Valor |
|---|---|
| Método actual | `UPDATE products SET is_active = !current WHERE id = $1` |
| **HTTP ideal** | `PATCH /api/products/:id/toggle` |

### 2.6 Delete Product
| Campo | Valor |
|---|---|
| Método actual | `DELETE FROM products WHERE id = $1` |
| **HTTP ideal** | `DELETE /api/products/:id` |

### 2.7 Duplicate Product
| Campo | Valor |
|---|---|
| Método actual | `SELECT * FROM products WHERE id` → `INSERT` copy + `INSERT stock_balances` |
| **HTTP ideal** | `POST /api/products/:id/duplicate` |

---

## 3. Stock (`src/lib/supabase-store.ts`)

### 3.1 Add Movement
| Campo | Valor |
|---|---|
| Pantalla | Stock |
| Método actual | `SELECT stock_balances` → `INSERT stock_movements` → `UPSERT stock_balances` |
| Entrada | `{ productId, type: PURCHASE|WASTE|SALE|ADJUST, qty, reason }` |
| **HTTP ideal** | `POST /api/stock/movements` |

### 3.2 Add Purchase With Expense
| Campo | Valor |
|---|---|
| Pantalla | Stock |
| Método actual | Multi-step: movement + balance + optional cost_price update + optional expense insert |
| Entrada | `{ productId, qty, reason, registerExpense?, totalPaid?, paymentMethod?, fund?, updateCostPrice?, newCostPrice?, supplierId? }` |
| **HTTP ideal** | `POST /api/stock/purchase` |

### 3.3 Fetch Movements
| Campo | Valor |
|---|---|
| Pantalla | Stock |
| Método actual | `SELECT *, products(name, variant_label, type) FROM stock_movements ORDER BY created_at DESC` |
| **HTTP ideal** | `GET /api/stock/movements` |

### 3.4 Apply Count (physical count)
| Campo | Valor |
|---|---|
| Pantalla | Stock |
| Método actual | Batch: for each product with diff → `INSERT stock_movements` + `UPSERT stock_balances` |
| Entrada | `Record<productId, realQty>` |
| **HTTP ideal** | `POST /api/stock/apply-count` |

### 3.5 Fetch Categories
| Campo | Valor |
|---|---|
| Método actual | `SELECT * FROM categories ORDER BY name` |
| **HTTP ideal** | `GET /api/categories` |

---

## 4. Precios (`src/lib/price-store.ts`)

### 4.1 Fetch Price Settings
| Método actual | `SELECT ... FROM price_settings WHERE id = 1` |
| **HTTP ideal** | `GET /api/settings/prices` |

### 4.2 Update Price Settings
| Método actual | `UPDATE price_settings SET credit_1_pct, credit_3_pct WHERE id = 1` |
| **HTTP ideal** | `PUT /api/settings/prices` |

### 4.3 Fetch Product Prices
| Método actual | `SELECT * FROM product_prices WHERE product_id = $1` |
| **HTTP ideal** | `GET /api/products/:id/prices` |

### 4.4 Ensure Product Prices (create missing)
| Método actual | Fetch → detect missing combinations → INSERT |
| **HTTP ideal** | `POST /api/products/:id/prices/ensure` |

### 4.5 Save Product Prices
| Método actual | Loop UPDATE for each channel/term combination |
| **HTTP ideal** | `PUT /api/products/:id/prices` body `{ prices: [...] }` |

### 4.6 Recalculate All Prices
| Método actual | Fetch base prices → loop UPDATE credit prices |
| **HTTP ideal** | `POST /api/prices/recalculate` |

### 4.7 Fetch Price Completeness
| Método actual | `SELECT product_id, price FROM product_prices` → aggregate in JS |
| **HTTP ideal** | `GET /api/products/price-completeness` |

---

## 5. POS (`src/lib/pos-store.ts`)

### 5.1 Fetch Active Products With Prices
| Pantalla | POS |
| Método actual | `SELECT ... FROM products WHERE is_active` + `SELECT ... FROM stock_balances` + `SELECT ... FROM product_prices` → join in JS |
| **HTTP ideal** | `GET /api/pos/products` (pre-joined) |

### 5.2 Create Sale
| Pantalla | POS |
| Método actual | Multi-step transaction: verify stock → INSERT pos_sales → INSERT pos_sale_items → INSERT pos_payments → INSERT stock_movements + UPDATE stock_balances |
| Entrada | `{ channel, price_term, delivery_fee, customer_id?, items[], payments[], discountLines[] }` |
| **HTTP ideal** | `POST /api/pos/sales` (atomic transaction) |

### 5.3 Create Layaway Sale
| Pantalla | POS |
| Método actual | Similar a 5.2 pero con status LAYAWAY + INSERT pos_layaways + deposit payment |
| Entrada | `{ saleData, items[], layawayData: { customerName, customerPhone, depositAmount, depositMethod, dueDate, notes } }` |
| **HTTP ideal** | `POST /api/pos/layaway-sales` |

---

## 6. Señas (`src/lib/layaway-store.ts`)

### 6.1 Fetch Layaways
| Método actual | `SELECT * FROM pos_layaways` + `SELECT ... FROM pos_sale_items WHERE sale_id IN (...)` |
| Entrada | `statusFilter?: string` |
| **HTTP ideal** | `GET /api/layaways?status=PENDING` |

### 6.2 Add Layaway Payment
| Método actual | SELECT layaway → INSERT pos_payments → UPDATE pos_layaways → optionally UPDATE pos_sales.status |
| Entrada | `{ layawayId, amount, paymentMethod }` |
| **HTTP ideal** | `POST /api/layaways/:id/payments` |

### 6.3 Cancel Layaway
| Método actual | UPDATE pos_layaways.status → UPDATE pos_sales.status → restore stock (loop INSERT stock_movements + UPDATE stock_balances) |
| **HTTP ideal** | `POST /api/layaways/:id/cancel` |

---

## 7. Ventas / Devoluciones (`src/lib/return-store.ts`)

### 7.1 Fetch Recent Sales
| Pantalla | Ventas |
| Método actual | SELECT pos_sales → SELECT pos_sale_items → SELECT pos_payments → SELECT profiles → SELECT products → optionally invoke `manage-users` edge function |
| Entrada | `limit: number` |
| **HTTP ideal** | `GET /api/sales?limit=100&status=COMPLETED` |

### 7.2 Process Return
| Pantalla | Ventas |
| Método actual | Loop: INSERT stock_movements (type=RETURN) + UPDATE stock_balances |
| Entrada | `{ saleId, items: [{ product_id, qty, name }] }` |
| **HTTP ideal** | `POST /api/sales/:id/returns` |

---

## 8. Cierre del día (`src/lib/cierre-store.ts`, `src/pages/CierreDelDia.tsx`)

### 8.1 Fetch Day Summary
| Método actual | `SELECT total, subtotal_local, subtotal_restaurant, delivery_fee FROM pos_sales WHERE status=COMPLETED AND date range` |
| **HTTP ideal** | `GET /api/closing/summary?date=YYYY-MM-DD` |

### 8.2 Fetch Payment Breakdown
| Método actual | SELECT sale IDs → SELECT pos_payments → aggregate by method+fund |
| **HTTP ideal** | `GET /api/closing/payments?date=YYYY-MM-DD` |

### 8.3 Fetch Product Lines
| Método actual | SELECT sale IDs → SELECT pos_sale_items WHERE owner → aggregate |
| **HTTP ideal** | `GET /api/closing/products?date=YYYY-MM-DD&owner=LOCAL` |

### 8.4 Fetch Range Summary/Payments/Products (semana)
| Método actual | Same as above but with from/to range |
| **HTTP ideal** | `GET /api/closing/summary?from=...&to=...` |

---

## 9. Finanzas (`src/lib/finanzas-store.ts`)

### 9.1 Fetch Resultado Range
| Método actual | SELECT pos_sales + pos_payments + pos_sale_items (with products join) + expenses → aggregate by day in JS |
| **HTTP ideal** | `GET /api/finance/resultado?from=...&to=...` |

### 9.2 Fetch Day Detail
| Método actual | SELECT sales for day → payments → items → expenses |
| **HTTP ideal** | `GET /api/finance/day-detail?date=YYYY-MM-DD` |

### 9.3 Fetch Capital Current
| Método actual | SELECT ALL pos_payments + expenses + fund_movements + cash_opening_balances → aggregate in JS |
| **HTTP ideal** | `GET /api/finance/capital` |

### 9.4 Create Expense
| Método actual | `INSERT INTO expenses` |
| Entrada | `{ date, amount, payment_method, category, description }` |
| **HTTP ideal** | `POST /api/finance/expenses` |

### 9.5 Delete Expense
| Método actual | `DELETE FROM expenses WHERE id` |
| **HTTP ideal** | `DELETE /api/finance/expenses/:id` |

### 9.6 Fetch Expenses Range
| Método actual | `SELECT * FROM expenses WHERE date BETWEEN` |
| **HTTP ideal** | `GET /api/finance/expenses?from=...&to=...` |

### 9.7 Upsert Opening Balance
| Método actual | SELECT existing → UPDATE or INSERT cash_opening_balances |
| **HTTP ideal** | `PUT /api/finance/opening-balances` |

### 9.8 Create Fund Movement
| Método actual | `INSERT INTO fund_movements` |
| **HTTP ideal** | `POST /api/finance/fund-movements` |

### 9.9 Delete Fund Movement
| Método actual | `DELETE FROM fund_movements WHERE id` |
| **HTTP ideal** | `DELETE /api/finance/fund-movements/:id` |

---

## 10. Reportes (`src/lib/reportes-store.ts`)

### 10.1 Fetch Top Products
| Método actual | SELECT sale IDs → SELECT pos_sale_items → aggregate |
| **HTTP ideal** | `GET /api/reports/top-products?from=...&to=...&limit=10` |

### 10.2 Fetch Sales By Day
| Método actual | SELECT pos_sales → aggregate by date |
| **HTTP ideal** | `GET /api/reports/sales-by-day?from=...&to=...` |

### 10.3 Fetch Sales By Method
| Método actual | SELECT sale IDs → SELECT pos_payments → aggregate |
| **HTTP ideal** | `GET /api/reports/sales-by-method?from=...&to=...` |

### 10.4 Fetch Margin By Category
| Método actual | SELECT sale IDs → items → products → aggregate by type |
| **HTTP ideal** | `GET /api/reports/margin-by-category?from=...&to=...` |

---

## 11. Clientes (`src/lib/customer-store.ts`, `src/lib/customer-stats-store.ts`)

### 11.1 Fetch Customers
| Método actual | `SELECT * FROM customers WHERE is_active ORDER BY full_name` |
| **HTTP ideal** | `GET /api/customers?active=true` |

### 11.2 Search Customers
| Método actual | `SELECT ... WHERE is_active AND (full_name ILIKE OR email ILIKE OR document ILIKE) LIMIT 10` |
| **HTTP ideal** | `GET /api/customers/search?q=...` |

### 11.3 Create Customer
| Método actual | `INSERT INTO customers` (with unique email handling) |
| **HTTP ideal** | `POST /api/customers` |

### 11.4 Update Customer
| Método actual | `UPDATE customers SET ... WHERE id` |
| **HTTP ideal** | `PUT /api/customers/:id` |

### 11.5 Delete Customer (soft)
| Método actual | `UPDATE customers SET is_active = false WHERE id` |
| **HTTP ideal** | `DELETE /api/customers/:id` |

### 11.6 Fetch Customer Ranking
| Método actual | SELECT pos_sales with customer_id → SELECT customers → aggregate in JS |
| Entrada | `{ from: Date, to: Date }` |
| **HTTP ideal** | `GET /api/customers/ranking?from=...&to=...` |

### 11.7 Fetch Customer Detail
| Método actual | SELECT pos_sales → pos_sale_items → aggregate products + monthly spend in JS |
| **HTTP ideal** | `GET /api/customers/:id/stats` |

---

## 12. Configuración (`src/lib/config-store.ts`)

### 12.1-12.3 Product Types CRUD
| Método actual | SELECT/INSERT/UPDATE `product_types` |
| **HTTP ideal** | `GET/POST/PUT /api/config/product-types` |

### 12.4-12.6 Product Categories CRUD
| Método actual | SELECT/INSERT/UPDATE `product_categories` |
| **HTTP ideal** | `GET/POST/PUT /api/config/product-categories` |

### 12.7-12.9 Variant Sets CRUD
| Método actual | SELECT/INSERT/UPDATE `variant_sets` |
| **HTTP ideal** | `GET/POST/PUT /api/config/variant-sets` |

### 12.10-12.12 Variant Values CRUD
| Método actual | SELECT/INSERT/UPDATE `variant_values` |
| **HTTP ideal** | `GET/POST/PUT /api/config/variant-values` |

### 12.13-12.15 Price Terms CRUD
| Método actual | SELECT/INSERT/UPDATE `price_terms` |
| **HTTP ideal** | `GET/POST/PUT /api/config/price-terms` |

---

## 13. Promociones (`src/lib/promotions-store.ts`)

### 13.1 Fetch Promotions (admin)
| Método actual | SELECT promotions + promotion_products |
| **HTTP ideal** | `GET /api/promotions` |

### 13.2 Create Promotion
| Método actual | INSERT promotions + INSERT promotion_products |
| **HTTP ideal** | `POST /api/promotions` |

### 13.3 Update Promotion
| Método actual | UPDATE promotions + DELETE/INSERT promotion_products |
| **HTTP ideal** | `PUT /api/promotions/:id` |

### 13.4 Toggle Promotion
| Método actual | `UPDATE promotions SET is_active` |
| **HTTP ideal** | `PATCH /api/promotions/:id/toggle` |

### 13.5 Fetch Active Promotions For Products
| Método actual | SELECT active promotions → promotion_products filtered by cart product IDs |
| **HTTP ideal** | `POST /api/promotions/for-products` body `{ product_ids }` |

### 13.6 Fetch Active Promotions With Products
| Método actual | SELECT promotions + promotion_products + products + stock_balances + product_prices |
| **HTTP ideal** | `GET /api/promotions/active-with-products` |

---

## 14. Proveedores (`src/lib/supplier-store.ts`)

### 14.1-14.4 Suppliers CRUD
| Método actual | SELECT/INSERT/UPDATE/DELETE `suppliers` |
| **HTTP ideal** | `GET/POST/PUT/DELETE /api/suppliers` |

### 14.5 Fetch Product Purchase History
| Método actual | `SELECT *, suppliers(name, phone) FROM stock_movements WHERE product_id AND type=PURCHASE` |
| **HTTP ideal** | `GET /api/products/:id/purchase-history` |

---

## 15. Conteo semanal (`src/lib/weekly-count-store.ts`)

### 15.1-15.7 Inventory Count lifecycle
| Operaciones | fetchCountForRange, createCount, fetchCountLines, saveDraft, applyCountAdjustments, closeCount, fetchLastClosedCount |
| Tablas | inventory_counts, inventory_count_lines, stock_movements, stock_balances, products |
| **HTTP ideal** | `GET/POST /api/inventory-counts`, `GET/PUT /api/inventory-counts/:id/lines`, `POST /api/inventory-counts/:id/apply`, `POST /api/inventory-counts/:id/close` |

---

## 16. Usuarios (Edge Function `manage-users`)

### 16.1-16.5 User Management
| Método actual | `supabase.functions.invoke("manage-users", { body: { action: "list|create|update-role|reset-password|delete" } })` |
| Tablas | auth.users (admin API), user_roles, profiles |
| **HTTP ideal** | `GET /api/users`, `POST /api/users`, `PUT /api/users/:id/role`, `PUT /api/users/:id/password`, `DELETE /api/users/:id` |

---

## 17. Auditoría (`src/components/config/AccesosTab.tsx`)

### 17.1 Fetch Audit Log
| Método actual | No verificado — asumido SELECT desde `audit_log` (visible en schema) |
| **HTTP ideal** | `GET /api/audit-log?limit=...` |
